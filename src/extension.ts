'use strict';

import { logger } from './Log';
import { workspace, ExtensionContext, TextDocument, WorkspaceFoldersChangeEvent, env, languages, window, commands, Uri, Disposable } from 'vscode';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { DevCompletionProvider } from './DevCompletionProvider';
import { applyChangesCommand, applySpecificModuleCommand, compileWorkspaceCommand, loginIntoDetectedInstancesCommand, logIntoSpecificInstanceCommand, logoutCommand, logoutFromSpecificInstanceCommand, trackFileCommand, untrackFilesCommand, copyLogicalNameCommand, copyPhysicalNameCommand, copyJsonNameCommand, itemDoubleClickTriggerCommand  } from './commands';
import { BarItem } from './BarItem';
import { ObjectInfoTree } from './treeView/ObjectInfoTree';
import { QuickPick } from './QuickPick';
import { FileTree } from './treeView/FileTree';
import { FileHandler } from './FileHandler';
import { ModuleHandler } from './ModuleHandler';
import { crossPlatformPath } from './utils';
import { OpenFileContext } from './interfaces';
import { template } from './constant';

export async function activate(context: ExtensionContext) {
	logger.info('Starting extension on ' + env.appName);
	
	const fileTree = new FileTree();
	window.registerTreeDataProvider(
		'simpliciteFile',
		fileTree
	);

	const moduleHandler = new ModuleHandler();
	const fileHandler = await FileHandler.build(fileTree, moduleHandler);
	const request = await SimpliciteAPIManager.build(fileHandler, moduleHandler);

	const barItem = new BarItem('Simplicite', request);
	request.setBarItem(barItem); // needs to be set on SimpliciteAPIManager to refresh
	barItem.show(moduleHandler.getModules(), moduleHandler.getConnectedInstancesUrl());
	
	new QuickPick(context, request);

	const objectInfoTree = new ObjectInfoTree(request);
	window.registerTreeDataProvider(
		'simpliciteObjectFields',
		objectInfoTree
	);
	commands.registerCommand('simplicite-vscode-tools.refreshTreeView', async () => await objectInfoTree.refresh());

	// Commands has to be declared in package.json so VS Code knows that the extension provides a command
	
	const applyChanges = applyChangesCommand(request);
	const applySpecificModule = applySpecificModuleCommand(request);
	const compileWorkspace = compileWorkspaceCommand(request);
	const loginIntoDetectedInstances = loginIntoDetectedInstancesCommand(request);
	const logIntoSpecificInstance = logIntoSpecificInstanceCommand(request);
	const logout = logoutCommand(request);
	const logoutFromSpecificInstance = logoutFromSpecificInstanceCommand(request, objectInfoTree.refresh, objectInfoTree);
	const trackFile = trackFileCommand(request);
	const untrackFile = untrackFilesCommand(request);

	const fieldToClipBoard = copyLogicalNameCommand();
	const copyPhysicalName = copyPhysicalNameCommand();
	const copyJsonName = copyJsonNameCommand();
	const itemDoubleClickTrigger = itemDoubleClickTriggerCommand(objectInfoTree);
	
	context.subscriptions.push(applyChanges, applySpecificModule, compileWorkspace, loginIntoDetectedInstances, logIntoSpecificInstance, logout, logoutFromSpecificInstance, trackFile, untrackFile, fieldToClipBoard, copyPhysicalName, copyJsonName, itemDoubleClickTrigger);

	// settings are set in the package.json
	if (!workspace.getConfiguration('simplicite-vscode-tools').get('api.autoConnect')) {
		try {
			await request.loginHandler();
		} catch (e) {
			logger.error(e);
		}
	};

	// On save file detection
	workspace.onDidSaveTextDocument(async (event: TextDocument) => {
		if (event.uri.path.search('.java') !== -1) {
			await fileHandler.setTrackedStatus(crossPlatformPath(event.uri.path), true, fileHandler.bindFileAndModule(moduleHandler.getModules()));
			barItem.show(moduleHandler.getModules(), moduleHandler.getConnectedInstancesUrl());
		}
	});

	// workspace handler
	workspace.onDidChangeWorkspaceFolders(async (event: WorkspaceFoldersChangeEvent) => { // The case where one folder is added and one removed should not happen
		moduleHandler.setModules(await fileHandler.getSimpliciteModules());
		barItem.show(moduleHandler.getModules(), moduleHandler.getConnectedInstancesUrl());
		if (event.added.length > 0) { // If a folder is added to workspace
			try {
				const currentModule = moduleHandler.getModuleFromName(event.added[0].name);
				if (!currentModule) {
					throw new Error('No known module name matches with the root folder of the project. Root folder = ' + event.added[0].name);
				}
				await request.loginTokenOrCredentials(currentModule); // connect with the module informations
				logger.info('successfully added module to workspace');
			} catch(e) {
				logger.error(e);
			}
		} else if (event.removed.length > 0) { // in this case, if a folder is removed we check if it's a simplicite module	
			logger.info('removed module from workspace');
		}
		moduleHandler.setModules(await fileHandler.getSimpliciteModules());
		fileTree.setFileModule(fileHandler.bindFileAndModule(moduleHandler.getModules()));
		barItem.show(moduleHandler.getModules(), moduleHandler.getConnectedInstancesUrl());
		await objectInfoTree.refresh();
		await fileHandler.getFileOnStart();
	});

	// Completion
	let completionProvider: Disposable | undefined = undefined;
	const prodiverMaker = async function (): Promise<Disposable | undefined> {
		const connectedInstances: string[] = moduleHandler.getConnectedInstancesUrl(); 
		if (connectedInstances.length > 0
		&& request.devInfo
		&& request.moduleDevInfo
		&& window.activeTextEditor) 
		{
			const filePath = crossPlatformPath(window.activeTextEditor.document.fileName);
			if (!filePath.includes('.java')) {
				return undefined;
			}
			const currentPageUri = window.activeTextEditor.document.uri;
			const workspaceUrl = DevCompletionProvider.getWorkspaceFromFileUri(currentPageUri);
			const instanceUrl = moduleHandler.getModuleUrlFromWorkspacePath(workspaceUrl);
			const moduleName = moduleHandler.getModuleNameFromUrl(instanceUrl); // need moduleName to set the moduleDevInfo
			if (!connectedInstances.includes(instanceUrl)) {
				logger.warn('Cannot provide completion, not connected to the module\'s instance');
				return undefined;
			}
			const openFileContext: OpenFileContext = {
				filePath: filePath,
				fileName: DevCompletionProvider.getFileNameFromPath(filePath),
				workspaceUrl: workspaceUrl,
				instanceUrl: instanceUrl
			};
			await request.moduleDevInfoSpecific(instanceUrl, moduleName); // sets module
			completionProvider = completionProviderHandler(openFileContext, request.devInfo, request.moduleDevInfo, context);
			return completionProvider;
		}
		return undefined;
	};

	try {
		completionProvider = await prodiverMaker(); // on start completion initialization
	} catch (e) {
		logger.error(e);
	}
	
	window.onDidChangeActiveTextEditor(async ()  => { // dispose the current completionProvider and initialize a new one
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
}

function completionProviderHandler (openFileContext: OpenFileContext, devInfo: any, moduleDevInfo: any, context: ExtensionContext): Disposable {
	const devCompletionProvider = new DevCompletionProvider(devInfo, moduleDevInfo, openFileContext);
	const completionProvider = languages.registerCompletionItemProvider(template, devCompletionProvider, '"');
	context.subscriptions.push(completionProvider);
	logger.info('completion ready');
	return completionProvider;
}