'use strict';

import { logger } from './Log';
import { workspace, ExtensionContext, TextDocument, WorkspaceFoldersChangeEvent, env, languages, window, Disposable } from 'vscode';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { CompletionProvider } from './CompletionProvider';
import { applyChangesCommand, applySpecificModuleCommand, compileWorkspaceCommand, loginIntoDetectedInstancesCommand, logIntoSpecificInstanceCommand, logoutCommand, logoutFromSpecificInstanceCommand, trackFileCommand, untrackFilesCommand, copyLogicalNameCommand, copyPhysicalNameCommand, copyJsonNameCommand, itemDoubleClickTriggerCommand } from './commands';
import { BarItem } from './BarItem';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { QuickPick } from './QuickPick';
import { FileTree } from './treeView/FileTree';
import { FileHandler } from './FileHandler';
import { ModuleHandler } from './ModuleHandler';
import { crossPlatformPath, validFileExtension } from './utils';
import { OpenFileContext } from './interfaces';
import { TEMPLATE } from './constant';

export async function activate(context: ExtensionContext): Promise<any> {
	logger.info('Starting extension on ' + env.appName);
	const fileTree = new FileTree(context.extensionUri.path);
	window.registerTreeDataProvider(
		'simpliciteFile',
		fileTree
	);
	const moduleHandler = new ModuleHandler();
	const fileHandler = await FileHandler.build(fileTree, moduleHandler, context);
	const barItem = new BarItem('Simplicite');
	const request = SimpliciteAPIManager.build(fileHandler, moduleHandler, barItem);
	request.setBarItem(barItem); // needs to be set on SimpliciteAPIManager to refresh
	barItem.show(moduleHandler.modules, moduleHandler.connectedInstancesUrl);

	new QuickPick(context, request);
	// settings are set in the package.json
	if (!workspace.getConfiguration('simplicite-vscode-tools').get('api.autoConnect')) {
		try {
			await request.loginHandler();
		} catch (e) {
			logger.error(e);
		}
	}

	const moduleInfoTree = new ModuleInfoTree(moduleHandler.modules, request.devInfo, context.extensionUri.path);
	window.registerTreeDataProvider(
		'simpliciteModuleInfo',
		moduleInfoTree
	);
	moduleHandler.setModuleInfoTree(moduleInfoTree); // refresh moduleInfoTree everytime a module is set or moduleDevInfo is changed 

	// Commands have to be declared in package.json so VS Code knows that the extension provides a command
	const applyChanges = applyChangesCommand(request);
	const applySpecificModule = applySpecificModuleCommand(request);
	const compileWorkspace = compileWorkspaceCommand(request);
	const loginIntoDetectedInstances = loginIntoDetectedInstancesCommand(request);
	const logIntoSpecificInstance = logIntoSpecificInstanceCommand(request);
	const logout = logoutCommand(request);
	const logoutFromSpecificInstance = logoutFromSpecificInstanceCommand(request);
	const trackFile = trackFileCommand(request);
	const untrackFile = untrackFilesCommand(request);

	const fieldToClipBoard = copyLogicalNameCommand();
	const copyPhysicalName = copyPhysicalNameCommand();
	const copyJsonName = copyJsonNameCommand();
	const itemDoubleClickTrigger = itemDoubleClickTriggerCommand(moduleInfoTree);

	context.subscriptions.push(applyChanges, applySpecificModule, compileWorkspace, loginIntoDetectedInstances, logIntoSpecificInstance, logout, logoutFromSpecificInstance, trackFile, untrackFile, fieldToClipBoard, copyPhysicalName, copyJsonName, itemDoubleClickTrigger);



	// On save file detection
	workspace.onDidSaveTextDocument(async (event: TextDocument) => {
		if (validFileExtension(event.uri.path)) {
			await fileHandler.setTrackedStatus(crossPlatformPath(event.uri.path), true, fileHandler.bindFileAndModule(moduleHandler.modules));
			barItem.show(moduleHandler.modules, moduleHandler.connectedInstancesUrl);
		}
	});

	// workspace handler
	workspace.onDidChangeWorkspaceFolders(async (event: WorkspaceFoldersChangeEvent) => { // The case where one folder is added and one removed should not happen
		moduleHandler.setModules(await fileHandler.getSimpliciteModules(), true);
		barItem.show(moduleHandler.modules, moduleHandler.connectedInstancesUrl);
		if (event.added.length > 0) { // If a folder is added to workspace
			try {
				const currentModule = moduleHandler.getModuleFromName(event.added[0].name);
				if (!currentModule) {
					throw new Error('No known module name matches with the root folder of the project. Root folder = ' + event.added[0].name);
				}
				await request.loginTokenOrCredentials(currentModule); // connect with the module informations
				logger.info('successfully added module to workspace');
			} catch (e) {
				logger.error(e);
			}
		} else if (event.removed.length > 0) { // in this case, if a folder is removed we check if it's a simplicite module	
			logger.info('removed module from workspace');
		}
		await request.refreshModuleDevInfo();
		fileTree.setFileModule(fileHandler.bindFileAndModule(moduleHandler.modules));
		barItem.show(moduleHandler.modules, moduleHandler.connectedInstancesUrl);
		await fileHandler.getFileOnStart();
	});

	// Completion
	let completionProvider: Disposable | undefined = undefined;
	const prodiverMaker = async function (): Promise<Disposable | undefined> {
		const connectedInstances: string[] = moduleHandler.connectedInstancesUrl;
		if (connectedInstances.length > 0
			&& request.devInfo
			&& moduleHandler.getAllModuleDevInfo().length > 0
			&& window.activeTextEditor) {
			const filePath = crossPlatformPath(window.activeTextEditor.document.fileName);
			if (!filePath.includes('.java')) {
				return undefined;
			}
			const currentPageUri = window.activeTextEditor.document.uri;
			const workspaceUrl = CompletionProvider.getWorkspaceFromFileUri(currentPageUri);
			const instanceUrl = moduleHandler.getModuleUrlFromWorkspacePath(workspaceUrl);
			const decomposed = workspaceUrl.split('/');
			const presumedModuleName = decomposed[decomposed.length - 1];
			const module = moduleHandler.getModuleFromName(presumedModuleName);
			if (!module) {
				return undefined;
			}
			if (!connectedInstances.includes(instanceUrl)) {
				logger.warn('Cannot provide completion, not connected to the module\'s instance');
				return undefined;
			}
			const openFileContext: OpenFileContext = {
				filePath: filePath,
				fileName: CompletionProvider.getFileNameFromPath(filePath),
				workspaceUrl: workspaceUrl,
				instanceUrl: instanceUrl
			};
			await request.moduleDevInfoSpecific(instanceUrl, module.name); // sets module
			completionProvider = completionProviderHandler(openFileContext, request.devInfo, module.moduleDevInfo, context);
			return completionProvider;
		}
		return undefined;
	};

	try {
		completionProvider = await prodiverMaker(); // on start completion initialization
	} catch (e) {
		logger.error(e);
	}

	window.onDidChangeActiveTextEditor(async () => { // dispose the current completionProvider and initialize a new one
		try {
			if (!completionProvider) {
				completionProvider = await prodiverMaker();
			} else {
				completionProvider.dispose();
				completionProvider = await prodiverMaker();
			}
		} catch (e) {
			logger.error(e);
		}
	});

	return { applyChanges, applySpecificModule, compileWorkspace, loginIntoDetectedInstances, logIntoSpecificInstance, logout, logoutFromSpecificInstance, trackFile, untrackFile };
}

function completionProviderHandler(openFileContext: OpenFileContext, devInfo: any, moduleDevInfo: any, context: ExtensionContext): Disposable {
	const devCompletionProvider = new CompletionProvider(devInfo, moduleDevInfo, openFileContext);
	const completionProvider = languages.registerCompletionItemProvider(TEMPLATE, devCompletionProvider, '"');
	context.subscriptions.push(completionProvider);
	logger.info('completion ready');
	return completionProvider;
}