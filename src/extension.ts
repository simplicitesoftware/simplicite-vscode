'use strict';

import { logger } from './Log';
import { workspace, ExtensionContext, TextDocument, WorkspaceFoldersChangeEvent, env, languages, window, Disposable, Uri } from 'vscode';
import { CompletionProvider } from './CompletionProvider';
import { BarItem } from './BarItem';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { QuickPick } from './QuickPick';
import { FileTree } from './treeView/FileTree';
import { FileHandler } from './FileHandler';
import { ModuleHandler } from './ModuleHandler';
import { validFileExtension } from './utils';
import { TEMPLATE } from './constant';
import { File } from './File';
import { SimpliciteApiController } from './SimpliciteApiController';
import { SimpliciteApi } from './SimpliciteApi';
import { AppHandler } from './AppHandler';
import { ApiFileSystemController } from './apiFileSystem/ApiFileSystemController';
import { commandInit } from './commands';

export async function activate(context: ExtensionContext): Promise<any> {
	logger.info('Starting extension on ' + env.appName);
	const barItem = new BarItem();
	const moduleHandler = await ModuleHandler.build(context.globalState, barItem);
	const fileHandler = await FileHandler.build(context.globalState, moduleHandler.modules);
	const appHandler = new AppHandler();
	const storageUri = extensionStoragePathMaker(context.globalStorageUri.path);

	const simpliciteApi = new SimpliciteApi(appHandler, storageUri);
	const simpliciteApiController = new SimpliciteApiController(moduleHandler, simpliciteApi, appHandler);
	new QuickPick(context.subscriptions, simpliciteApiController);

	const fileTree = new FileTree(context.extensionUri.path, moduleHandler.modules, fileHandler.fileList);
	window.registerTreeDataProvider('simpliciteFile', fileTree);
	fileHandler.fileTree = fileTree;

	const moduleInfoTree = new ModuleInfoTree(moduleHandler.modules, simpliciteApiController.devInfo, context.extensionUri.path);
	window.registerTreeDataProvider('simpliciteModuleInfo', moduleInfoTree);
	simpliciteApiController.moduleInfoTree = moduleInfoTree;

	commandInit(context, simpliciteApiController, moduleHandler, fileHandler, moduleInfoTree, storageUri);

	if (!workspace.getConfiguration('simplicite-vscode-tools').get('api.autoConnect')) { // settings are set in the package.json
		try {
			await simpliciteApiController.loginAll();
		} catch (e) {
			logger.error(e);
		}
	}
	// init potentials api file systems
	const initApiFileSystems = async () => {
		for (const module of moduleHandler.modules) {
			try {
				for (const rfs of simpliciteApiController.apiFileSystemController) {
					if (rfs.module.name === module.name) {
						throw new Error();
					}
				}
				if (module.apiFileSystem && simpliciteApiController.devInfo) {
					const app = simpliciteApiController.appHandler.getApp(module.instanceUrl);
					const rfsControl = new ApiFileSystemController(app, module, simpliciteApiController.devInfo, storageUri);
					simpliciteApiController.apiFileSystemController.push(rfsControl);
					await rfsControl.initAll(moduleHandler);	
				}
			} catch (e) {
				continue;
			}
		}
	};
	await initApiFileSystems();

	// On save file detection
	workspace.onDidSaveTextDocument(async (event: TextDocument) => {
		if (validFileExtension(event.uri.path)) {
			// when the diff editor (to resolve conflict) is saved by user, vscode will trigger two times the onDidSaveTextDocument event
			// Ignore the second event using the isConflict variable as the first thrown event is the file that has been saved
			// meaning that the content of the file has to synchronize with the instance
			if (event.uri.path.includes('RemoteFile.java') || event.uri.path.includes('workspace.json')) {
				return;
			}
			const file = fileHandler.getFileFromFullPath(event.uri.path); // get the file from event path
			if (file.path === '') { // file not found
				window.showErrorMessage('Simplicite: ' + event.uri.path + ' cannot be found.');
			}
			const module = moduleHandler.getModuleFromWorkspacePath(file.workspaceFolderPath);
			if (!module) {
				logger.error('Cannot get module info from ' + file.workspaceFolderPath ? file.workspaceFolderPath : 'undefined');
				return;
			}
			if (module.apiFileSystem) { // module is api
				await simpliciteApi.writeFile(file, simpliciteApiController.devInfo, module);
				// add conflict handling here not in writeFile
			} else { // module is not api
				await fileHandler.setTrackedStatus(file.path, true, moduleHandler.modules); // on save set the status of the file to true
			}
		}
	});

	// workspace handler
	workspace.onDidChangeWorkspaceFolders(async (event: WorkspaceFoldersChangeEvent) => { // The case where one folder is added and one removed should not happen
		await moduleHandler.setModulesFromScratch(); // resets the modules from disk and persistance
		if (event.added.length > 0) { // If a folder is added to workspace
			const currentModule = moduleHandler.getModuleFromWorkspacePath(event.added[0].uri.path);
			if (!currentModule) {
				throw new Error('No known module name matches with the root folder of the project. Root folder = ' + event.added[0].name);
			}
			await simpliciteApiController.tokenOrCredentials(currentModule); // connect with the module informations
			logger.info('successfully added module to workspace');
		} else if (event.removed.length > 0) {
			// refresh for potential api file systems
			// usefull when user removes the workspace using the vscode shortcut (should be using the command)
			const module = moduleHandler.removeModuleFromWkPath(event.removed[0].uri.path);
			let index = 0;
			if (!module) return;
			for (const rfs of simpliciteApiController.apiFileSystemController) {
				index++;
				if (rfs.module.name === module.name) {
					if (rfs.module.workspaceFolderPath === '') { // important condition, if empty string => Uri.parse can resolve to the root of the main disk and delete every file
						logger.error('workspaceFolderPath is undefined');
						return;
					}
					const uri = Uri.parse(rfs.module.workspaceFolderPath);
					workspace.fs.delete(uri);
					simpliciteApiController.apiFileSystemController = simpliciteApiController.apiFileSystemController.splice(index, 1);
					logger.info('removed api module from workspace');
					break;
				}
			}
		}
		// refresh all
		fileHandler.fileList = await fileHandler.FileDetector(moduleHandler.modules);
		moduleInfoTree.feedData(simpliciteApiController.devInfo, moduleHandler.modules);
		await initApiFileSystems();
	});

	// Completion
	let completionProvider: Disposable | undefined = undefined;
	const prodiverMaker = async function (): Promise<Disposable | undefined> { // see following try catch and onDidChangeActiveTextEditor
		const connectedInstances: string[] = moduleHandler.connectedInstances;
		if (connectedInstances.length > 0
			&& simpliciteApiController.devInfo
			&& moduleHandler.modules.length
			&& window.activeTextEditor) {
			const filePath = window.activeTextEditor.document.uri.path;
			if (!filePath.includes('.java')) {
				return undefined;
			}
			const file = fileHandler.getFileFromFullPath(filePath);
			const module = moduleHandler.getModuleFromWorkspacePath(file.workspaceFolderPath);
			if (!module) {
				return undefined;
			}
			if (!connectedInstances.includes(file.simpliciteUrl)) {
				logger.warn('Cannot provide completion, not connected to the module\'s instance');
				return undefined;
			}
			completionProvider = completionProviderHandler(simpliciteApiController.devInfo, module.moduleDevInfo, context, file);
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

	//return { applyChanges, applySpecificModule, compileWorkspace, loginIntoDetectedInstances, logIntoSpecificInstance, logout, logoutFromSpecificInstance, trackFile, untrackFile };
}

export function deactivate(context: ExtensionContext) {
	context.globalState.get('simplicite-modules-info', );
}

function completionProviderHandler(devInfo: any, moduleDevInfo: any, context: ExtensionContext, file: File): Disposable {
	const devCompletionProvider = new CompletionProvider(devInfo, moduleDevInfo, file);
	const completionProvider = languages.registerCompletionItemProvider(TEMPLATE, devCompletionProvider, '"');
	context.subscriptions.push(completionProvider);
	logger.info('completion ready');
	return completionProvider;
}

function extensionStoragePathMaker (path: string) {
	const decomposed = path.split('/');
	decomposed.splice(decomposed.length - 1);
	const newPath = decomposed.join('/');
	const uri = Uri.parse(newPath);
	return uri;
}