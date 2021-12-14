'use strict';

import { commands, window, env, Uri, workspace, ExtensionContext } from 'vscode';
import { logger } from './Log';
import { SimpliciteApiController } from './SimpliciteApiController';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { Module } from './Module';
import { File } from './File';
import { ApiFileSystemController } from './apiFileSystem/ApiFileSystemController';
import { ModuleHandler } from './ModuleHandler';
import { FileHandler } from './FileHandler';
import { isHttpsUri, isHttpUri } from 'valid-url';
import { SimpliciteApi } from './SimpliciteApi';

// Commands are added in extension.ts into the vscode context
// Commands also need to to be declared as contributions in the package.json

// ------------------------------
// Apply commands

export const commandInit = function (context: ExtensionContext, simpliciteApiController: SimpliciteApiController, moduleHandler: ModuleHandler, fileHandler: FileHandler, moduleInfoTree: ModuleInfoTree, storageUri: Uri) {
	const applyChanges = commands.registerCommand('simplicite-vscode-tools.applyChanges', async function () {
		await simpliciteApiController.applyAll(fileHandler, moduleHandler.modules);
	});
	
	const applySpecificModule = commands.registerCommand('simplicite-vscode-tools.applySpecificModule', async function (element: SimpliciteApiController | any) {
		// eslint-disable-next-line no-prototype-builtins
		if (!element.hasOwnProperty('label') && !element.hasOwnProperty('description')) {
			element = await inputFilePath('Simplicite: Type in the module name', 'module name');
			const moduleObject: Module | undefined = moduleHandler.getModuleFromName(element);
			if (!moduleObject) {
				window.showErrorMessage('Simplicite: ' + element + ' is not a module');
			}
		}
		const module = moduleHandler.getModuleFromParentFolder(element.label);
		if (!module) {
			window.showErrorMessage('Simplicite: ' + element + ' is not a module');
			return;
		}
		await simpliciteApiController.applyModuleFiles(fileHandler, module, moduleHandler.modules);
	});
	
	// ------------------------------
	// Compiling commands
	const compileWorkspace = commands.registerCommand('simplicite-vscode-tools.compileWorkspace', async function () {
		try {
			const status = await simpliciteApiController.compileJava();
			logger.info(status);
		} catch (e) {
			logger.error(e);
		}
	});
	
	// ------------------------------
	// Authentication commands
	const loginIntoDetectedInstances = commands.registerCommand('simplicite-vscode-tools.logIn', async () => {
		await simpliciteApiController.loginAll();
	});
	
	const logIntoSpecificInstance = commands.registerCommand('simplicite-vscode-tools.logIntoSpecificInstance', async function () {
		try {
			const moduleName = await window.showInputBox({
				placeHolder: 'module name / url',
				title: 'Simplicite: Type the name of the module'
			});
			if (!moduleName) {
				throw new Error();
			}
			let flag = false;
			let module;
			try {
				for (const moduleLoop of moduleHandler.modules) {
					if (moduleLoop.instanceUrl === moduleName) {
						module = moduleLoop;
						flag = true;
					}
				}
				if (module === undefined) {
					throw new Error('error no module found in LogInInstanceCommand');
				}
			} catch (e) {
				for (const moduleLoop of moduleHandler.modules) {
					if (moduleLoop.name === moduleName) {
						module = moduleLoop;
						flag = true;
					}
				}
			}
			if (module && !moduleHandler.connectedInstances.includes(module.instanceUrl)) {
				await simpliciteApiController.tokenOrCredentials(module);
			}
			if (!flag) {
				throw new Error(`Simplicite: Cannot find module or url ${moduleName}`);
			}
		} catch (e: any) {
			logger.error(e);
			window.showInformationMessage(e.message ? e.message : e);
		}
	});
	
	const logout = commands.registerCommand('simplicite-vscode-tools.logOut', async function () {
		await simpliciteApiController.logoutAll();
		
	});
	
	const logoutFromSpecificInstance = commands.registerCommand('simplicite-vscode-tools.logOutFromInstance', async function () {
		try {
			const input = await window.showInputBox({
				placeHolder: 'module name / url',
				title: 'Simplicite: Type the name of the module'
			});
			if (!input) {
				throw new Error();
			}
			let flag = false;
			let module;
			try {
				for (const moduleLoop of moduleHandler.modules) {
					if (moduleLoop.instanceUrl === input) {
						module = moduleLoop;
						flag = true;
					}
				}
				if (module === undefined) {
					throw new Error('error no module found in logoutFromSpecificInstanceCommand');
				}
			} catch (e) {
				for (const moduleLoop of moduleHandler.modules) {
					if (moduleLoop.name === input) {
						module = moduleLoop;
						flag = true;
					}
				}
			}
			if (module) {
				await simpliciteApiController.instanceLogout(module.instanceUrl);
			}
			if (!flag) {
				throw new Error(`Simplicite: Cannot find module or url ${input}`);
			}

		} catch (e: any) {
			logger.error(e);
			window.showInformationMessage(e.message ? e.message : e);
		}

	});
	
	// ------------------------------
	// File handling commands
	const trackFile = commands.registerCommand('simplicite-vscode-tools.trackFile', async function (element: any) {
		try {
			await trackAction(fileHandler, moduleHandler.modules, element, true);
		} catch (e) {
			logger.error(e);
		}
	});
	
	const untrackFile = commands.registerCommand('simplicite-vscode-tools.untrackFile', async function (element: any) {
		try {
			await trackAction(fileHandler, moduleHandler.modules, element, false);
		} catch (e) {
			logger.error(e);
		}
		
	});
	
	// ------------------------------
	
	const refreshModuleTree = commands.registerCommand('simplicite-vscode-tools.refreshModuleTree', async function () {
		moduleHandler.refreshModulesDevInfo(simpliciteApiController.simpliciteApi);
		simpliciteApiController.moduleInfoTree?.feedData(simpliciteApiController.devInfo, moduleHandler.modules);
	});
	
	const refreshFileHandler = commands.registerCommand('simplicite-vscode-tools.refreshFileHandler', async function () {
		if (fileHandler.fileTree) {
			const modules = moduleHandler.modules;
			fileHandler.fileList = await fileHandler.FileDetector(modules);
		}
	});
	
	// ------------------------------
	// Tree view commands
	const copyLogicalName = commands.registerCommand('simplicite-vscode-tools.copyLogicalName', (element) => {
		if (!element.label) {
			logger.error('cannot copy logical name: label is undefined');
		} else {
			env.clipboard.writeText(element.label);
		}
	});
	
	const copyPhysicalName = commands.registerCommand('simplicite-vscode-tools.copyPhysicalName', (element) => {
		if (!element.description) {
			logger.error('cannot copy copy physical name: description is undefined');
		} else {
			env.clipboard.writeText(element.description);
		}
	});
	
	const copyJsonName = commands.registerCommand('simplicite-vscode-tools.copyJsonName', (element) => {
		if (!element.additionalInfo) {
			logger.error('cannot copy jsonName: additionalInfo is undefined');
		} else {
			env.clipboard.writeText(element.additionalInfo);
		}
	});
	
	const itemDoubleClickTrigger = commands.registerCommand('simplicite-vscode-tools.itemDoubleClickTrigger', (logicName: string) => {
		if (doubleClickTrigger()) {
			try {
				moduleInfoTree.insertFieldInDocument(logicName);
			} catch (e) {
				logger.error(e);
			}
		}
	});
	
	// ------------------------------
	
	const connectToRemoteFileSystem = commands.registerCommand('simplicite-vscode-tools.connectToRemoteFileSystem', async () => {
		try {
			const instanceUrl = await window.showInputBox({
				placeHolder: 'instance url',
				title: 'Simplicite: Type the name of the instance url'
			});
			if (!instanceUrl) {
				throw new Error();
			} if (!isHttpsUri(instanceUrl) && !isHttpUri(instanceUrl)) {
				throw new Error(instanceUrl + ' is not a valid url');
			}
			const moduleName = await window.showInputBox({
				placeHolder: 'module name',
				title: 'Simplicite: Type the name of the module'
			});
			if (!moduleName) {
				throw new Error();
			}
			const token = moduleHandler.getInstanceToken(instanceUrl); // get token if exists
			const module = new Module(moduleName, '', instanceUrl, token, true, true);
			moduleHandler.addModule(module, true);
			await simpliciteApiController.tokenOrCredentials(module);
			if (!simpliciteApiController.devInfo || !moduleHandler.connectedInstances.includes(instanceUrl)) {
				throw new Error();
			}
			const apiFileSystemController = new ApiFileSystemController(simpliciteApiController.appHandler.getApp(instanceUrl), module, simpliciteApiController.devInfo, storageUri);
			simpliciteApiController.apiFileSystemController.push(apiFileSystemController);
			apiFileSystemController.initAll(moduleHandler);
		} catch (e: any) {
			logger.error(e);
			window.showInformationMessage(e.message ? e.message : e);
		}
	});
	
	const disconnectRemoteFileSystem = commands.registerCommand('simplicite-vscode-tools.disconnectRemoteFileSystem', async () => {
		if (!simpliciteApiController.apiFileSystemController) {
			return;
		}
		const moduleName = await window.showInputBox({
			placeHolder: 'module name',
			title: 'Simplicite: Type the name of the remote module to remove from workspace'
		});
		if (!moduleName) {
			throw new Error();
		}
		let module: undefined | Module;
		let objIndex = 0;
		for (const rfs of simpliciteApiController.apiFileSystemController) {
			objIndex++;
			if (rfs.module.name === moduleName) {
				module = rfs.module;
			}
		}
		if (!module) {
			try {
				let index = 0;
				if (!workspace.workspaceFolders) {
					throw new Error();
				}
				for (const wk of workspace.workspaceFolders) {
					if (wk.name === 'Api_' + moduleName) {
						moduleHandler.removeApiModule('Api_' + moduleName, moduleInfoTree, simpliciteApiController.devInfo);
						workspace.updateWorkspaceFolders(index, 1);
					}
					index++;
				}
			} catch (e) {
				return;
			}
			return;
		}
		simpliciteApiController.apiFileSystemController.splice(objIndex - 1, 1); // remove apiFileSystemController
		if (moduleHandler.countModulesOfInstance(module.instanceUrl) === 1) { // if the removed api module is the only module connected to the instance, disconnect
			await simpliciteApiController.instanceLogout(module.instanceUrl);
		} else { // else remove the module 
			moduleHandler.removeApiModule(module.parentFolderName, moduleInfoTree, simpliciteApiController.devInfo);
		}
		try {
			if (!workspace.workspaceFolders) {
				throw new Error();
			}
			let index = 0;
			for (const wk of workspace.workspaceFolders) {
				if (wk.name === module.parentFolderName) {
					workspace.updateWorkspaceFolders(index, 1);
				}
				index++;
			}
			// need to delete after workspace change, otherwise resource is busy
			if (module.workspaceFolderPath === '') { // important condition, if empty string => Uri.parse can resolve to the root of the main disk and delete every file
				throw 'No module workspaceFolderPath';
			}
			const uri = Uri.parse(module.workspaceFolderPath);
			await workspace.fs.delete(uri , { recursive: true });
		} catch (e) {
			logger.error(e);
		}
	});
	
	// ------------------------------

	context.subscriptions.push(applyChanges, applySpecificModule, compileWorkspace, loginIntoDetectedInstances, logIntoSpecificInstance, logout, logoutFromSpecificInstance, trackFile, untrackFile, refreshModuleTree, refreshFileHandler, copyLogicalName, copyPhysicalName, copyJsonName, itemDoubleClickTrigger, connectToRemoteFileSystem, disconnectRemoteFileSystem);
};

let firstClickTime = new Date().getTime();

function doubleClickTrigger(): boolean {
	const doubleClickTime = 500;
	const currentTime = new Date().getTime();
	if ((currentTime - firstClickTime) <= doubleClickTime) {
		return true;
	} else {
		firstClickTime = new Date().getTime();
		return false;
	}
}

async function trackAction(fileHandler: FileHandler, modules: Module[], element: any, trackedValue: boolean) {
	const inputFile = await getInputFile(fileHandler, element);
	await fileHandler.setTrackedStatus(inputFile.path, trackedValue, modules);
}

async function getInputFile(fileHandler: FileHandler, element: any): Promise<File> {
	if (element.fullPath) {
		return fileHandler.getFileFromFullPath(element.fullPath);
	} else {
		const input = await inputFilePath('Simplicite: Type in the file\'s absolute path', 'path');
		return fileHandler.getFileFromFullPath(input);
	}
}

async function inputFilePath(title: string, placeHolder: string) {
	const fileInput = await window.showInputBox({
		placeHolder: placeHolder,
		title: title
	});
	if (!fileInput) {
		throw new Error('Simplicite: file input cancelled');
	}
	return fileInput;
}




