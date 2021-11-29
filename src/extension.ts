'use strict';

import { logger } from './Log';
import { workspace, ExtensionContext, TextDocument, WorkspaceFoldersChangeEvent, env, languages, window, Disposable } from 'vscode';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { CompletionProvider } from './CompletionProvider';
import { applyChangesCommand, applySpecificModuleCommand, compileWorkspaceCommand, loginIntoDetectedInstancesCommand, logIntoSpecificInstanceCommand, logoutCommand, logoutFromSpecificInstanceCommand, trackFileCommand, untrackFilesCommand, refreshModuleTreeCommand, refreshFileHandlerCommand, copyLogicalNameCommand, copyPhysicalNameCommand, copyJsonNameCommand, itemDoubleClickTriggerCommand, connectToRemoteFileSystemCommand, disconnectRemoteFileSystemCommand, initApiWorkspaceCommand, initApiFilesCommand, deleteApiWorkspaceCommand } from './commands';
import { BarItem } from './BarItem';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { QuickPick } from './QuickPick';
import { FileTree } from './treeView/FileTree';
import { FileHandler } from './FileHandler';
import { ModuleHandler } from './ModuleHandler';
import { validFileExtension } from './utils';
import { OpenFileContext } from './interfaces';
import { TEMPLATE } from './constant';
import { Module } from './Module';

export async function activate(context: ExtensionContext): Promise<any> {
	logger.info('Starting extension on ' + env.appName);
	const moduleHandler = await ModuleHandler.build(context.globalState);
	const fileHandler = await FileHandler.build(context.globalState, moduleHandler.modules);
	
	const request = new SimpliciteAPIManager(fileHandler, moduleHandler);

	new QuickPick(context.subscriptions, request);

	const barItem = new BarItem();
	request.barItem = barItem; // refresh on log in and logout

	const bindedFileAndModule = fileHandler.bindFileAndModule(moduleHandler.modules);
	const fileTree = new FileTree(context.extensionUri.path, bindedFileAndModule);
	window.registerTreeDataProvider('simpliciteFile', fileTree);
	fileHandler.fileTree = fileTree;

	const moduleInfoTree = new ModuleInfoTree(moduleHandler.modules, request.devInfo, context.extensionUri.path);
	window.registerTreeDataProvider('simpliciteModuleInfo', moduleInfoTree);
	request.moduleInfoTree = moduleInfoTree;

	// Commands have to be declared in package.json so VS Code knows that the extension provides a command
	const applyChanges = applyChangesCommand(request);
	const applySpecificModule = applySpecificModuleCommand(request, moduleHandler);
	const compileWorkspace = compileWorkspaceCommand(request);
	const loginIntoDetectedInstances = loginIntoDetectedInstancesCommand(request);
	const logIntoSpecificInstance = logIntoSpecificInstanceCommand(request, moduleHandler);
	const logout = logoutCommand(request);
	const logoutFromSpecificInstance = logoutFromSpecificInstanceCommand(request, moduleHandler);
	const trackFile = trackFileCommand(request, fileHandler, moduleHandler);
	const untrackFile = untrackFilesCommand(request, fileHandler, moduleHandler);
	const refreshModuleTree = refreshModuleTreeCommand(request);
	const refreshFileHandler = refreshFileHandlerCommand(fileHandler, moduleHandler);

	const fieldToClipBoard = copyLogicalNameCommand();
	const copyPhysicalName = copyPhysicalNameCommand();
	const copyJsonName = copyJsonNameCommand();
	const itemDoubleClickTrigger = itemDoubleClickTriggerCommand(moduleInfoTree);
	const connectToRemoteFileSystem = connectToRemoteFileSystemCommand(moduleHandler, moduleHandler.connectedInstancesUrl, request);
	const disconnectRemoteFileSystem = disconnectRemoteFileSystemCommand(moduleHandler, request);
	const initApiWorkspace = initApiWorkspaceCommand();
	const initApiFiles = initApiFilesCommand(request);
	const deleteApiWorkspace = deleteApiWorkspaceCommand(request);

	context.subscriptions.push(applyChanges, applySpecificModule, compileWorkspace, loginIntoDetectedInstances, logIntoSpecificInstance, logout, logoutFromSpecificInstance, trackFile, untrackFile, fieldToClipBoard, refreshModuleTree, refreshFileHandler, copyPhysicalName, copyJsonName, itemDoubleClickTrigger, connectToRemoteFileSystem, disconnectRemoteFileSystem, initApiWorkspace, initApiFiles, deleteApiWorkspace);

	if (!workspace.getConfiguration('simplicite-vscode-tools').get('api.autoConnect')) { // settings are set in the package.json
		try {
			await request.loginHandler();
		} catch (e) {
			logger.error(e);
		}
	}

	// On save file detection
	workspace.onDidSaveTextDocument(async (event: TextDocument) => {
		if (validFileExtension(event.uri.path)) {
			if (event.uri.path.includes('RemoteFile.java')) {
				return;
			}
			const file = fileHandler.getFileFromFullPath(event.uri.path);
			const module = moduleHandler.getModuleFromWorkspacePath(file.workspaceFolderPath);
			if (!module) {
				logger.error('Cannot get module info from ' + file.workspaceFolderPath);
				return;
			}
			if (module.remoteFileSystem && request.RFSControl) {
				await request.attachFileAndSend(file, request.appHandler.getApp(module.instanceUrl));
			}
		}
	});

	// workspace handler
	workspace.onDidChangeWorkspaceFolders(async (event: WorkspaceFoldersChangeEvent) => { // The case where one folder is added and one removed should not happen
		const oldModules = moduleHandler.modules;
		await moduleHandler.setSimpliciteModulesFromDisk();
		moduleHandler.setSavedData();
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
			const instance = getDisconnectedInstance(moduleHandler.connectedInstancesUrl, oldModules);
			if (instance) {
				await request.specificLogout(instance);
			}
			logger.info('removed module from workspace');
		}
		await fileHandler.FileDetector(moduleHandler.modules);
		await request.refreshModuleDevInfo();
		fileTree.setFileModule(fileHandler.bindFileAndModule(moduleHandler.modules));
	});

	// Completion
	let completionProvider: Disposable | undefined = undefined;
	const prodiverMaker = async function (): Promise<Disposable | undefined> { // see following try catch and onDidChangeActiveTextEditor
		const connectedInstances: string[] = moduleHandler.connectedInstancesUrl;
		if (connectedInstances.length > 0
			&& request.devInfo
			&& moduleHandler.modules.length
			&& window.activeTextEditor) {
			const filePath = window.activeTextEditor.document.fileName;
			if (!filePath.includes('.java')) {
				return undefined;
			}
			const currentPageUri = window.activeTextEditor.document.uri;
			const workspaceUrl = CompletionProvider.getWorkspaceFromFileUri(currentPageUri);
			const module = moduleHandler.getModuleFromWorkspacePath(workspaceUrl);
			if (!module) {
				return undefined;
			}
			const instanceUrl = module.instanceUrl;
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

export function deactivate(context: ExtensionContext) {
	context.globalState.get('simplicite-modules-info', );
}

function completionProviderHandler(openFileContext: OpenFileContext, devInfo: any, moduleDevInfo: any, context: ExtensionContext): Disposable {
	const devCompletionProvider = new CompletionProvider(devInfo, moduleDevInfo, openFileContext);
	const completionProvider = languages.registerCompletionItemProvider(TEMPLATE, devCompletionProvider, '"');
	context.subscriptions.push(completionProvider);
	logger.info('completion ready');
	return completionProvider;
}

function getDisconnectedInstance (connectedInstances: string[], modules: Module[]): string | false {
	const listInstance = [];
	for (const instance of connectedInstances) {
		listInstance.push({instance: instance, current: false});
	}
	for (const mod of modules) {
		for (const currentInstance of listInstance) {
			if (mod.instanceUrl === currentInstance.instance) {
				currentInstance.current = true;
			}
		}
	}
	let instance: string | false = false;
	for (const currentInstance of listInstance) {
		if (!currentInstance.current) {
			instance = currentInstance.instance;
		}
	}
	return instance;
}