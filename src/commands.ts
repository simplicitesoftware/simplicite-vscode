'use strict';

import { commands, window, env, Uri, workspace, ExtensionContext } from 'vscode';
import { logger } from './Log';
import { SimpliciteApiController } from './SimpliciteApiController';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { Module } from './Module';
import { File } from './File';
import { ModuleHandler } from './ModuleHandler';
import { FileHandler } from './FileHandler';
import { isHttpsUri, isHttpUri } from 'valid-url';
import { SimpliciteApi } from './SimpliciteApi';
import { AppHandler } from './AppHandler';
import { ApiFileSystemController } from './ApiFileSystemController';
import { FileItem } from './treeView/treeViewClasses';
import { WorkspaceController } from './WorkspaceController';
import { ApiModule } from './ApiModule';

// Commands are added in extension.ts into the vscode context
// Commands also need to to be declared as contributions in the package.json

// ------------------------------
// Apply commands
export const commandInit = function (context: ExtensionContext, simpliciteApiController: SimpliciteApiController, simpliciteApi: SimpliciteApi, moduleHandler: ModuleHandler, fileHandler: FileHandler, moduleInfoTree: ModuleInfoTree, appHandler: AppHandler, apiFileSystemController: ApiFileSystemController) {
	const applyChanges = commands.registerCommand('simplicite-vscode-tools.applyChanges', async function () {
		await simpliciteApiController.applyAll(moduleHandler.modules);
	});
	
	const applySpecificModule = commands.registerCommand('simplicite-vscode-tools.applySpecificModule', async function (element: SimpliciteApiController | any) {
		try {
			const instanceUrl = await simpleInput('Simplicite: Type in the instance url', 'instance url');
			// todo , see what's inside element and add instanceUrl (no need for input here)
			let module: Module | ApiModule | null;
			if (!element.hasOwnProperty('label') && !element.hasOwnProperty('description')) {
				element = await simpleInput('Simplicite: Type in the module name', 'module name');
				module = moduleHandler.getModuleFromNameAndInstance(element, instanceUrl);
			} else {
				module = moduleHandler.getModuleFromNameAndInstance(element.label, instanceUrl);	
			}
			if(module) await simpliciteApiController.applyModuleFiles(module, moduleHandler.modules);
			else throw new Error('Cannot get module ' + element.label ? element.label : element);
		} catch(e) {
			logger.error("Simplicité: " + e);
		}
	});

	const applySpecificInstance = commands.registerCommand('simplicite-vscode-tools.applySpecificInstance', async function () {
		try {
			const instanceUrl = await simpleInput('Simplicite: Type in the instance url' ,'instance url');
			await simpliciteApiController.applyInstanceFiles(moduleHandler.modules, instanceUrl, moduleHandler.connectedInstances);
		} catch(e) {
			logger.error(e);
		}
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
			const module = await logAction();
			await simpliciteApiController.tokenOrCredentials(module);
		} catch (e: any) {
			logger.error(e);
		}
	});

	const logoutFromSpecificInstance = commands.registerCommand('simplicite-vscode-tools.logOutFromInstance', async function () {
		try {
			const module = await logAction();
			await simpliciteApiController.instanceLogout(module.instanceUrl);
		} catch (e: any) {
			logger.error(e);
		}
	});

	async function logAction(): Promise<Module | ApiModule> {
		const instanceUrl = await simpleInput('Simplicite: Type the url of the Simplicité instance', 'instance url');
		const module = moduleHandler.getFirstModuleFromInstance(instanceUrl);
		if (!module) throw new Error('No module affiliated with instance ' + instanceUrl);
		return module;
	}
	
	const logout = commands.registerCommand('simplicite-vscode-tools.logOut', async function () {
		await simpliciteApiController.logoutAll();
	});

	
	// ------------------------------
	// File handling commands
	const trackFile = commands.registerCommand('simplicite-vscode-tools.trackFile', async function (element: FileItem) {
		try {
			await trackAction(fileHandler, moduleHandler.modules, element, true);
		} catch (e) {
			logger.error(e);
		}
	});
	
	const untrackFile = commands.registerCommand('simplicite-vscode-tools.untrackFile', async function (element: FileItem) {
		try {
			await trackAction(fileHandler, moduleHandler.modules, element, false);
		} catch (e) {
			logger.error(e);
		}
	});
	
	// ------------------------------
	// Refresh Tree views commands
	const refreshModuleTree = commands.registerCommand('simplicite-vscode-tools.refreshModuleTree', async function () {
		moduleHandler.refreshModulesDevInfo(simpliciteApi, fileHandler);
		moduleInfoTree?.feedData(simpliciteApi.devInfo, moduleHandler.modules);
	});
	
	const refreshFileHandler = commands.registerCommand('simplicite-vscode-tools.refreshFileHandler', async function () {
		if (fileHandler.fileTree) {
			const modules = moduleHandler.modules;
			fileHandler.fileList = await fileHandler.FileDetector(moduleHandler);
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
	
	const initApiFileSystem = commands.registerCommand('simplicite-vscode-tools.initApiFileSystem', async () => {
		// todo , check and handle case where process is aborted and info needs to stay relevant
		try {
			const instanceUrl = await simpleInput('Simplicite: Type the name of the instance base URL', 'instance url'); 
			if (!isHttpsUri(instanceUrl) && !isHttpUri(instanceUrl)) throw new Error(instanceUrl + ' is not a valid url');
	
			const moduleName = await simpleInput('Simplicite: Type the name of the module to add to the workspace', 'module name');
			const token = moduleHandler.getInstanceToken(instanceUrl); // get token if exists
			const module = new ApiModule(moduleName, '', instanceUrl, token, appHandler.getApp(instanceUrl), simpliciteApi);
			if(token !== '') {
				module.connected = true;
				moduleHandler.addModule(module, true);
				await moduleHandler.loginModuleState(simpliciteApi, module, '', fileHandler);
			} else {
				moduleHandler.addModule(module, true);
				await simpliciteApiController.tokenOrCredentials(module);
			}
		} catch (e: any) {
			logger.error(e);
			window.showInformationMessage('Simplicite: ' + e.message ? e.message : e);
		}
	});
	
	const removeApiFileSystem = commands.registerCommand('simplicite-vscode-tools.removeApiFileSystem', async () => {
		try {
			const moduleUrl = await simpleInput('Simplicite: Type in the api module name', 'moduleName@instance.url');
			const module = moduleHandler.getApiModuleFromApiName(moduleUrl);
			if (!module) throw new Error('');
			WorkspaceController.removeApiFileSystemFromWorkspace(module);
			//module.deleteProject();
			//await apiFileSystemController.removeApiFileSystem(module);
			
		} catch(e: any) {
			logger.error(e);
			window.showInformationMessage('Simplicite: ' + e.message ? e.message : e);
		}
		
	});



		// if (apiFileSystemController.apiFileSystemList.length === 0) {
		// 	return;
		// }
		// const moduleName = await window.showInputBox({
		// 	placeHolder: 'module name',
		// 	title: 'Simplicite: Type the name of the module to remove from the workspace'
		// });
		// if (!moduleName) {
		// 	throw new Error('Empty module name');
		// }
		// let module: undefined | Module;
		// let objIndex = 0;
		// for (const rfs of apiFileSystemController.apiFileSystemList) {
		// 	objIndex++;
		// 	if (rfs.module.name === moduleName) {
		// 		module = rfs.module;
		// 	}
		// }
		// if (!module) {
		// 	try {
		// 		let index = 0;
		// 		if (!workspace.workspaceFolders) {
		// 			throw new Error();
		// 		}
		// 		for (const wk of workspace.workspaceFolders) {
		// 			if (wk.name === module) {
		// 				moduleHandler.removeApiModule('Api_' + moduleName, moduleInfoTree, simpliciteApi.devInfo);
		// 				workspace.updateWorkspaceFolders(index, 1);
		// 			}
		// 			index++;
		// 		}
		// 	} catch (e) {
		// 		moduleHandler.removeApiModule('Api_' + moduleName, moduleInfoTree, simpliciteApi.devInfo);
		// 	}
		// 	return;
		// }
		// apiFileSystemController.apiFileSystemList.splice(objIndex - 1, 1); // remove apiFileSystem
		// if (moduleHandler.countModulesOfInstance(module.instanceUrl) === 1) { // if the removed api module is the only module connected to the instance, disconnect
		// 	await simpliciteApiController.instanceLogout(module.instanceUrl);
		// } else { // else remove the module 
		// 	moduleHandler.removeApiModule(module.parentFolderName, moduleInfoTree, simpliciteApi.devInfo);
		// }
		// try {
		// 	if (!workspace.workspaceFolders) {
		// 		throw new Error();
		// 	}
		// 	let index = 0;
		// 	for (const wk of workspace.workspaceFolders) {
		// 		if (wk.name === module.parentFolderName) {
		// 			workspace.updateWorkspaceFolders(index, 1);
		// 		}
		// 		index++;
		// 	}
		// 	// need to delete after workspace change, otherwise resource is busy
		// 	if (module.workspaceFolderPath === '') { // important condition, if empty string => Uri.file can resolve to the root of the main disk and delete every file
		// 		throw 'No module workspaceFolderPath';
		// 	}
		// 	const uri = Uri.file(module.workspaceFolderPath);
		// 	await workspace.fs.delete(uri , { recursive: true });
		// } catch (e) {
		// 	logger.error(e);
		// }

	
	// ------------------------------

	// public command can be used by other dev if needed
	const publicCommand = [applyChanges, applySpecificInstance,  applySpecificModule, compileWorkspace, loginIntoDetectedInstances, logIntoSpecificInstance, logout, logoutFromSpecificInstance, trackFile, untrackFile, refreshModuleTree, refreshFileHandler, initApiFileSystem, removeApiFileSystem];
	// private commands are needed for the tree views, it's not relevant to expose them
	const privateCommand = [copyLogicalName, copyPhysicalName, copyJsonName, itemDoubleClickTrigger];
	context.subscriptions.concat(publicCommand, privateCommand);
	return publicCommand;
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

async function trackAction(fileHandler: FileHandler, modules: Module[], element: FileItem, trackedValue: boolean) {
	const file = await getInputFile(fileHandler, element);
	await fileHandler.setTrackedStatus(file.uri, trackedValue, modules);
}

async function getInputFile(fileHandler: FileHandler, element: FileItem): Promise<File> {
	if (!element.resourceUri) {
		const input = await simpleInput('Simplicite: Type in the file\'s absolute path', 'path');
		return fileHandler.getFileFromFullPath(input);
	} else {
		return fileHandler.getFileFromFullPath(element.resourceUri.path);		
	}
}

async function simpleInput(title: string, placeHolder: string) {
	const input = await window.showInputBox({
		placeHolder: placeHolder,
		title: title
	});
	if (!input) throw new Error('Simplicité: input cancelled');
	return input;
}




