'use strict';

import { logger } from './Log';
import { workspace, ExtensionContext, TextDocument, WorkspaceFoldersChangeEvent, env, languages, window, commands, Uri } from 'vscode';
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

	// Completion initialization 
	// This step needs to be executed after the first login as it's going to fetch the fields from the simplicite API
	
	/*const provider = await CompletionProvider.build(request);
	const completionProviderSingleQuote = languages.registerCompletionItemProvider(provider.template, provider, '"');
	context.subscriptions.push(completionProviderSingleQuote);*/
	

	// workspace handler
	let modulesLength = moduleHandler.moduleLength(); // usefull to compare module change on onDidChangeWorkspaceFolders
	workspace.onDidChangeWorkspaceFolders(async (event: WorkspaceFoldersChangeEvent) => { // The case where one folder is added and one removed should not happen
		barItem.show(moduleHandler.getModules(), moduleHandler.getConnectedInstancesUrl());
		const tempModules = await fileHandler.getSimpliciteModules();
		if (event.added.length > 0 && tempModules.length > modulesLength) { // If a folder is added to workspace and it's a simplicité module
			logger.info('added module to workspace');
			modulesLength = tempModules.length;
			try {
				await request.loginTokenOrCredentials(moduleHandler.getModules()[moduleHandler.moduleLength() - 1]); // We need to connect with the module informations
			} catch(e) {
				logger.error(e);
			}
		} else if (event.removed.length > 0 && tempModules.length < modulesLength) { // in this case, if a folder is removed we check if it's a simplicite module	
			modulesLength = moduleHandler.moduleLength();
			logger.info('removed module from workspace');
		}
		moduleHandler.setModules(await fileHandler.getSimpliciteModules());
		fileTree.setFileModule(fileHandler.bindFileAndModule(moduleHandler.getModules()));
		barItem.show(moduleHandler.getModules(), moduleHandler.getConnectedInstancesUrl());
		await objectInfoTree.refresh();
		await fileHandler.getFileOnStart();
	});

	// Completion
	if (moduleHandler.getConnectedInstancesUrl()
		&& request.devInfo
		&& request.moduleDevInfo
		&& window.activeTextEditor) 
	{
		completionProviderHandler(moduleHandler.getConnectedInstancesUrl(), request.devInfo, request.moduleDevInfo, window.activeTextEditor.document, context);
	}
	
	window.onDidChangeActiveTextEditor(async event => {
		try {
			if (event === undefined) {
				throw new Error('Cannot get the event value out of the "onDidChangeActiveTextEditor" event');
			}
			
		} catch (e) {
			logger.error(e);
		}
	});
}

function completionProviderHandler (connectedInstances: string[], devInfo: any, moduleDevInfo: any, currentPage: TextDocument, context: ExtensionContext) {
	if (currentPage.uri.path.includes('.java') && devInfo && moduleDevInfo) {
		const filePath = crossPlatformPath(currentPage.fileName);
		const openFileContext: OpenFileContext = {
			filePath: filePath,
			fileName: DevCompletionProvider.getFileNameFromPath(filePath),
			workspaceUrl: DevCompletionProvider.getWorkspaceFromFileUri(currentPage.uri)
		};
		const devCompletionProvider = new DevCompletionProvider(devInfo, moduleDevInfo, openFileContext);
		const completionProvider = languages.registerCompletionItemProvider(template, devCompletionProvider, '"');
		context.subscriptions.push(completionProvider);
	}
}