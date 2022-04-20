'use strict';

import { logger } from './Log';
import { workspace, ExtensionContext, TextDocument, env, languages, window, Disposable } from 'vscode';
import { CompletionProvider } from './CompletionProvider';
//import { BarItem } from './BarItem';
//import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { QuickPick } from './QuickPick';
//import { FileTree } from './treeView/FileTree';
//import { FileHandler } from './FileHandler';
//import { ModuleHandler } from './ModuleHandler';
import { validFileExtension } from './utils';
import { initGlobalValues } from './constants';
import { File } from './File';
//import { SimpliciteApiController } from './SimpliciteApiController';
import { SimpliciteApi } from './SimpliciteApi';
import { AppHandler } from './AppHandler';
import { commandInit } from './commands';
import { DevInfo } from './DevInfo';
//import { WorkspaceController } from './WorkspaceController';
import { SimpliciteInstanceController } from './SimpliciteInstanceController';
import { Prompt } from './Prompt';

export async function activate(context: ExtensionContext): Promise<any> {
	initGlobalValues(context.globalStorageUri.path);
	//addFileTransportOnDesktop(STORAGE_PATH); // write a log file only on desktop context, on other contexts logs are written in the console
	logger.info('Starting extension on ' + env.appName);
	
	const prompt = new Prompt(context.globalState);

	const simpliciteInstanceController = await SimpliciteInstanceController.build(prompt, context.globalState);
	await simpliciteInstanceController.loginAll();

	const publicCommand = commandInit(context, simpliciteInstanceController, prompt);

	new QuickPick(context.subscriptions);
	
	// const barItem = new BarItem();
	// const appHandler = new AppHandler();
	// const simpliciteApi = new SimpliciteApi(appHandler);
	// const moduleHandler = await ModuleHandler.build(context.globalState, barItem, appHandler, simpliciteApi);
	// const fileHandler = await FileHandler.build(context.globalState, moduleHandler);
	
	// const simpliciteApiController = new SimpliciteApiController(moduleHandler, simpliciteApi, appHandler, fileHandler);
	// 

	// if (!workspace.getConfiguration('simplicite-vscode-tools').get('api.sendFileOnSave')) {
	// 	const fileTree = new FileTree(context.extensionUri.path, moduleHandler.modules, fileHandler.fileList);
	// 	window.registerTreeDataProvider('simpliciteFile', fileTree);
	// 	fileHandler.fileTree = fileTree;
	// }

	// const moduleInfoTree = new ModuleInfoTree(moduleHandler.modules, simpliciteApi.devInfo, context.extensionUri.path);
	// window.registerTreeDataProvider('simpliciteModuleInfo', moduleInfoTree);
	// simpliciteApiController.setModuleInfoTree(moduleInfoTree);

	// const publicCommand = commandInit(context, simpliciteApiController, simpliciteApi, moduleHandler, fileHandler, moduleInfoTree, appHandler, barItem);

	// if (workspace.getConfiguration('simplicite-vscode-tools').get('api.autoAuthentication')) { // settings are set in the package.json
	// 	try {
	// 		await simpliciteApiController.loginAll();
	// 	} catch (e) {
	// 		logger.error(e);
	// 	}
	// }

	// await WorkspaceController.workspaceFolderChangeListener(moduleHandler, simpliciteApiController, fileHandler, simpliciteApi, moduleInfoTree, appHandler, barItem);

	// // Save file detection
	// workspace.onDidSaveTextDocument(async (event: TextDocument) => {
	// 	// when the diff editor (to resolve conflict) is saved by user, vscode will trigger twice the onDidSaveTextDocument event (one event for each file)
	// 	// if the uri is from RemoteFileContent.java ignore as the changes are expected to be on the working file

	// 	// check for file extension validity && ignore workspace.json && ignore RemoteFileContent.java
	// 	if (!validFileExtension(event.uri.path) || event.uri.path.includes('workspace.json') || event.uri.path.includes('RemoteFileContent.java')) {
	// 		return;
	// 	}
	// 	if (simpliciteApiController.backendCompiling) {
	// 		window.showErrorMessage('Simplicite: Cannot apply changes as backend is still processing compilation');
	// 		return;
	// 	}
	// 	const file = fileHandler.getFileFromFullPath(event.uri.path); // get the file from event path
	// 	if (file.uri.path === '') { // file not found
	// 		window.showErrorMessage('Simplicite: ' + event.uri.path + ' cannot be found.');
	// 	}
	// 	if (simpliciteApiController.conflictStatus) {
	// 		await simpliciteApiController.resolveConflict(file);
	// 		return;
	// 	}
	// 	const module = moduleHandler.getModuleFromWorkspacePath(file.workspaceFolderPath);
	// 	if (!module) {
	// 		logger.error('Cannot get module info from ' + file.workspaceFolderPath ? file.workspaceFolderPath : 'undefined');
	// 		return;
	// 	}
	// 	try {
	// 		if (workspace.getConfiguration('simplicite-vscode-tools').get('api.sendFileOnSave')) { // sendFileOnSave is true
	// 			await simpliciteApiController.writeFileController(file, module);
	// 		} else { // module is not api, add option to apply changes classic on save (vscode options)
	// 			await fileHandler.setTrackedStatus(file.uri, true, moduleHandler.modules); // on save set the status of the file to true
	// 		}
	// 	} catch (e: any) {
	// 		window.showErrorMessage('Simplicite: ' + e.message);
	// 	}
	// });

	// // workspace handler
	

	// // Completion
	// let completionProvider: Disposable | undefined = undefined;
	// const prodiverMaker = async function (): Promise<Disposable | undefined> { // see following try catch and onDidChangeActiveTextEditor
	// 	const connectedInstances: string[] = moduleHandler.connectedInstances;
	// 	if (connectedInstances.length > 0
	// 		&& simpliciteApi.devInfo
	// 		&& moduleHandler.modules.length
	// 		&& window.activeTextEditor) {
	// 		const filePath = window.activeTextEditor.document.uri.path;
	// 		const file = fileHandler.getFileFromFullPath(filePath);
	// 		if (file.extension !== '.java') {
	// 			return undefined;
	// 		}
	// 		// set the api file info onDidChangeActiveTextEditor
	// 		const module = moduleHandler.getModuleFromWorkspacePath(file.workspaceFolderPath);
	// 		if (!module || !module.moduleDevInfo) {
	// 			return undefined;
	// 		}
	// 		if (!connectedInstances.includes(file.simpliciteUrl)) {
	// 			logger.warn('Cannot provide completion, not connected to the module\'s instance');
	// 			return undefined;
	// 		}
	// 		completionProvider = completionProviderHandler(simpliciteApi.devInfo, module.moduleDevInfo, context, file);
	// 		return completionProvider;
	// 	}
	// 	return undefined;
	// };

	// try {
	// 	completionProvider = await prodiverMaker(); // on start completion initialization
	// } catch (e) {
	// 	logger.error(e);
	// }

	// window.onDidChangeActiveTextEditor(async () => { // dispose the current completionProvider and initialize a new one
	// 	try {
	// 		if (!completionProvider) {
	// 			completionProvider = await prodiverMaker();
	// 		} else {
	// 			completionProvider.dispose();
	// 			completionProvider = await prodiverMaker();
	// 		}
	// 	} catch (e) {
	// 		logger.error(e);
	// 	}
	// });

	// return publicCommand;
}

function completionProviderHandler(devInfo: DevInfo, moduleDevInfo: any, context: ExtensionContext, file: File): Disposable {
	const devCompletionProvider = new CompletionProvider(devInfo, moduleDevInfo, file);
	const completionProvider = languages.registerCompletionItemProvider(TEMPLATE, devCompletionProvider, '"');
	context.subscriptions.push(completionProvider);
	logger.info('completion ready');
	return completionProvider;
}
