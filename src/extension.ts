'use strict';

import { logger } from './Log';
import { workspace, ExtensionContext, TextDocument, WorkspaceFoldersChangeEvent, env, languages, window, Disposable, Uri, commands } from 'vscode';
import { CompletionProvider } from './CompletionProvider';
import { BarItem } from './BarItem';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { QuickPick } from './QuickPick';
import { FileTree } from './treeView/FileTree';
import { FileHandler } from './FileHandler';
import { ModuleHandler } from './ModuleHandler';
import { validFileExtension } from './utils';
import { initGlobalValues } from './constants';
import { File } from './File';
import { SimpliciteApiController } from './SimpliciteApiController';
import { SimpliciteApi } from './SimpliciteApi';
import { AppHandler } from './AppHandler';
import { ApiFileSystemController } from './ApiFileSystemController';
import { commandInit } from './commands';

export async function activate(context: ExtensionContext): Promise<any> {
	logger.info('Starting extension on ' + env.appName);
	initGlobalValues(context.globalStorageUri.path);
	const barItem = new BarItem();
	const moduleHandler = await ModuleHandler.build(context.globalState, barItem);
	const fileHandler = await FileHandler.build(context.globalState, moduleHandler.modules);
	const appHandler = new AppHandler();

	const simpliciteApi = new SimpliciteApi(appHandler);
	const simpliciteApiController = new SimpliciteApiController(moduleHandler, simpliciteApi, appHandler);
	new QuickPick(context.subscriptions, simpliciteApiController);

	if (!workspace.getConfiguration('simplicite-vscode-tools').get('api.sendFileOnSave')) {
		const fileTree = new FileTree(context.extensionUri.path, moduleHandler.modules, fileHandler.fileList);
		window.registerTreeDataProvider('simpliciteFile', fileTree);
		fileHandler.fileTree = fileTree;
	}

	const moduleInfoTree = new ModuleInfoTree(moduleHandler.modules, simpliciteApi.devInfo, context.extensionUri.path);
	window.registerTreeDataProvider('simpliciteModuleInfo', moduleInfoTree);
	simpliciteApiController.setModuleInfoTree(moduleInfoTree);

	commandInit(context, simpliciteApiController, simpliciteApi, moduleHandler, fileHandler, moduleInfoTree, appHandler);

	if (workspace.getConfiguration('simplicite-vscode-tools').get('api.autoAuthentication')) { // settings are set in the package.json
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
				if (module.apiFileSystem && simpliciteApi.devInfo) {
					const app = appHandler.getApp(module.instanceUrl);
					const rfsControl = new ApiFileSystemController(app, module, simpliciteApi.devInfo);
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
		// when the diff editor (to resolve conflict) is saved by user, vscode will trigger two times the onDidSaveTextDocument event (one event for each file)
		// if the uri is from RemoteFileContent.java ignore as the changes are expected to be on the working file

		// check for file extension validity && ignore workspace.json && ignore RemoteFileContent.java
		if (!validFileExtension(event.uri.path) || event.uri.path.includes('workspace.json') || event.uri.path.includes('RemoteFileContent.java')) {
			return;
		}
		const file = fileHandler.getFileFromFullPath(event.uri.path); // get the file from event path
		if (file.uri.path === '') { // file not found
			window.showErrorMessage('Simplicite: ' + event.uri.path + ' cannot be found.');
		}
		file.setApiFileInfo(simpliciteApi.devInfo);
		if (simpliciteApiController.conflictStatus) {
			await simpliciteApiController.resolveConflict(file);
			return;
		}
		const module = moduleHandler.getModuleFromWorkspacePath(file.workspaceFolderPath);
		if (!module) {
			logger.error('Cannot get module info from ' + file.workspaceFolderPath ? file.workspaceFolderPath : 'undefined');
			return;
		}
		try {
			if (module.apiFileSystem || workspace.getConfiguration('simplicite-vscode-tools').get('api.sendFileOnSave')) { // module is api || sendFileOnSave is true
				await simpliciteApiController.writeFileController(file, module);
			} else { // module is not api, add option to apply changes classic on save (vscode options)
				await fileHandler.setTrackedStatus(file.uri, true, moduleHandler.modules); // on save set the status of the file to true
			}
		} catch (e: any) {
			window.showErrorMessage('Simplicite: ' + e.message);
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
					if (rfs.module.workspaceFolderPath === '') { // important condition, if empty string => Uri.file can resolve to the root of the main disk and delete every file (not fun)
						logger.error('workspaceFolderPath is undefined');
						return;
					}
					const uri = Uri.file(rfs.module.workspaceFolderPath);
					workspace.fs.delete(uri);
					simpliciteApiController.apiFileSystemController = simpliciteApiController.apiFileSystemController.splice(index, 1);
					logger.info('removed api module from workspace');
					break;
				}
			}
		}
		// refresh all
		fileHandler.fileList = await fileHandler.FileDetector(moduleHandler.modules);
		moduleInfoTree.feedData(simpliciteApi.devInfo, moduleHandler.modules);
		await initApiFileSystems();
	});

	// Completion
	let completionProvider: Disposable | undefined = undefined;
	const prodiverMaker = async function (): Promise<Disposable | undefined> { // see following try catch and onDidChangeActiveTextEditor
		const connectedInstances: string[] = moduleHandler.connectedInstances;
		if (connectedInstances.length > 0
			&& simpliciteApi.devInfo
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
			completionProvider = completionProviderHandler(simpliciteApi.devInfo, module.moduleDevInfo, context, file);
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

// deactivate is inconstant ???
export async function deactivate() {
	const uri = Uri.parse(STORAGE_PATH, true);
	try {
		await workspace.fs.delete(uri, { recursive: true });
	} catch (e) {
		logger.error(e);
	}
}

function completionProviderHandler(devInfo: any, moduleDevInfo: any, context: ExtensionContext, file: File): Disposable {
	const devCompletionProvider = new CompletionProvider(devInfo, moduleDevInfo, file);
	const completionProvider = languages.registerCompletionItemProvider(TEMPLATE, devCompletionProvider, '"');
	context.subscriptions.push(completionProvider);
	logger.info('completion ready');
	return completionProvider;
}

