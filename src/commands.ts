'use strict';

import { commands, window, env, workspace, ExtensionContext } from 'vscode';
import { logger } from './Log';
// import { SimpliciteApiController } from './SimpliciteApiController';
// import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { Module } from './Module';
import { File } from './File';
//import { ModuleHandler } from './ModuleHandler';
// import { FileHandler } from './FileHandler';
import { isHttpsUri, isHttpUri } from 'valid-url';
import { SimpliciteApi } from './SimpliciteApi';
import { AppHandler } from './AppHandler';
import { FileItem } from './treeView/treeViewClasses';
// import { WorkspaceController } from './WorkspaceController';
import { ApiModule } from './ApiModule';
// import { BarItem } from './BarItem';
import { Prompt } from './Prompt';
import { SimpliciteInstanceController } from './SimpliciteInstanceController';

// Commands are added in extension.ts into the vscode context
// Commands also need to to be declared as contributions in the package.json

// ------------------------------
// Apply commands
export const commandInit = function (context: ExtensionContext, simpliciteInstanceController: SimpliciteInstanceController, prompt: Prompt) {

	const applyChanges = commands.registerCommand('simplicite-vscode-tools.applyChanges', async function () {
		const res = await simpliciteInstanceController.sendAllFiles();
	});

	const applySpecificInstance = commands.registerCommand('simplicite-vscode-tools.applySpecificInstance', async function () {
		try {
			const instanceUrl = await prompt.getUserSelectedValue('url' ,'Simplicite: Type in the instance url', 'instance url');
			const res = await simpliciteInstanceController.sendInstanceFilesOnCommand(instanceUrl);
			prompt.addElement('url', instanceUrl);
		} catch(e) {
			logger.error(e);
		}
	});
	
	const applySpecificModule = commands.registerCommand('simplicite-vscode-tools.applySpecificModule', async function () {
		try {
			const instanceUrl = await prompt.getUserSelectedValue('url' ,'Simplicite: Type in the instance url', 'instance url');
			const moduleName = await prompt.getUserSelectedValue('name', 'Simplicite: Type in the module name', 'module name');
			const res = await simpliciteInstanceController.sendModuleFilesOnCommand(moduleName, instanceUrl);
			prompt.addElement('url', instanceUrl);
			prompt.addElement('name', moduleName);
		} catch(e) {
			logger.error(e);
		}
	});

	
	
	// ------------------------------
	// Compiling commands
	// const compileWorkspace = commands.registerCommand('simplicite-vscode-tools.compileWorkspace', async function () {
	// 	try {
	// 		const status = await simpliciteApiController.compileJava();
	// 		logger.info(status);
	// 	} catch (e) {
	// 		logger.error(e);
	// 	}
	// });
	
	// ------------------------------
	// Reset prompt cache
	const resetPromptCache = commands.registerCommand('simplicite-vscode-tools.resetPromptCache', async () => {
		prompt.resetValues();
	});


	// Authentication commands
	const login = commands.registerCommand('simplicite-vscode-tools.login', async () => {
		await simpliciteInstanceController.loginAll();
	});

  const logout = commands.registerCommand('simplicite-vscode-tools.logout', async () => {
		await simpliciteInstanceController.logoutAll();
	});
	
	const logIntoInstance = commands.registerCommand('simplicite-vscode-tools.logIntoInstance', async function () {
    try {
      const instanceUrl = await prompt.getUserSelectedValue('url', 'Simplicite: Type the url of the Simplicité instance', 'instance url');
      await simpliciteInstanceController.loginInstance(instanceUrl);
    } catch(e) {
      logger.error(e);
    }
	});

	const logoutFromInstance = commands.registerCommand('simplicite-vscode-tools.logoutFromInstance', async function () {
		try {
      const instanceUrl = await prompt.getUserSelectedValue('url', 'Simplicite: Type the url of the Simplicité instance', 'instance url');
      await simpliciteInstanceController.logoutInstance(instanceUrl);
		} catch(e) {
      logger.error(e);
    }
	});

	// async function logAction(): Promise<Module | ApiModule> {
	// 	const instanceUrl = await prompt.getUserSelectedValue('url', 'Simplicite: Type the url of the Simplicité instance', 'instance url');
	// 	const module = moduleHandler.getFirstModuleFromInstance(instanceUrl);
	// 	if (!module) throw new Error('No module affiliated with instance ' + instanceUrl);
	// 	prompt.addElement('url', instanceUrl);
	// 	return module;
	// }
	
	

	// const resetPersistence = commands.registerCommand('simplicite-vscode-tools.resetPersistence', () => {
	// 	context.globalState.update('simplicite-modules-info', undefined);
	// 	barItem.show(moduleHandler.modules, moduleHandler.connectedInstances);
	// });
	
	// ------------------------------
	// File handling commands
	// const trackFile = commands.registerCommand('simplicite-vscode-tools.trackFile', async function (element: FileItem) {
	// 	try {
	// 		await trackAction(fileHandler, moduleHandler.modules, element, true);
	// 	} catch (e) {
	// 		logger.error(e);
	// 	}
	// });
	
	// const untrackFile = commands.registerCommand('simplicite-vscode-tools.untrackFile', async function (element: FileItem) {
	// 	try {
	// 		await trackAction(fileHandler, moduleHandler.modules, element, false);
	// 	} catch (e) {
	// 		logger.error(e);
	// 	}
	// });
	
	// // ------------------------------
	// // Refresh Tree views commands
	// const refreshModuleTree = commands.registerCommand('simplicite-vscode-tools.refreshModuleTree', async function () {
	// 	moduleHandler.refreshModulesDevInfo(simpliciteApi, fileHandler);
	// 	moduleInfoTree?.feedData(simpliciteApi.devInfo, moduleHandler.modules);
	// });
	
	// const refreshFileHandler = commands.registerCommand('simplicite-vscode-tools.refreshFileHandler', async function () {
	// 	if (fileHandler.fileTree) {
	// 		fileHandler.fileList = await fileHandler.FileDetector(moduleHandler);
	// 	}
	// });
	
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
	
	// const itemDoubleClickTrigger = commands.registerCommand('simplicite-vscode-tools.itemDoubleClickTrigger', (logicName: string) => {
	// 	if (doubleClickTrigger()) {
	// 		try {
	// 			moduleInfoTree.insertFieldInDocument(logicName);
	// 		} catch (e) {
	// 			logger.error(e);
	// 		}
	// 	}
	// });
	
	// ------------------------------
	
	// const initApiFileSystem = commands.registerCommand('simplicite-vscode-tools.initApiFileSystem', async () => {
	// 	// todo , check and handle case where process is aborted and info needs to stay relevant
	// 	let moduleName;
	// 	let instanceUrl;
	// 	try {
	// 		instanceUrl = await prompt.getUserSelectedValue('url', 'Simplicite: Type the name of the instance base URL', 'instance url'); 
	// 		if (!isHttpsUri(instanceUrl) && !isHttpUri(instanceUrl)) throw new Error(instanceUrl + ' is not a valid url');
	
	// 		moduleName = await prompt.getUserSelectedValue('name', 'Simplicite: Type the name of the module to add to the workspace', 'module name');
	// 		const token = moduleHandler.getInstanceToken(instanceUrl); // get token if exists
	// 		const module = new ApiModule(moduleName, '', instanceUrl, token, appHandler.getApp(instanceUrl), simpliciteApi, workspace.name);
	// 		if(token !== '') {
	// 			module.connected = true;
	// 			module.moduleDevInfo = await simpliciteApi.fetchModuleInfo(instanceUrl, moduleName);
	// 			moduleHandler.addModule(module, true);
	// 			await moduleHandler.loginModuleState(simpliciteApi, module, module.token, fileHandler);
	// 		} else {
	// 			moduleHandler.addModule(module, true);
	// 			const res = await simpliciteApiController.tokenOrCredentials(module);
	// 			if (!res) throw('');
	// 		}
	// 		prompt.addElement('url', instanceUrl);
	// 		prompt.addElement('name', moduleName);
	// 	} catch (e: any) {
	// 		if(e.message !== 'Simplicité: input cancelled' && e !== '') window.showInformationMessage('Simplicite: ' + e.message);
	// 		logger.error(e);
	// 		try {
	// 			moduleHandler.removeModule(moduleName ? moduleName : '', instanceUrl ? instanceUrl : '');
	// 		} catch(e) {
	// 			logger.warn('Attempt to remove module after init api module process aborted failed');
	// 		}
	// 	}
	// });
	
	// const removeApiFileSystem = commands.registerCommand('simplicite-vscode-tools.removeApiFileSystem', async () => {
	// 	try {
	// 		const apiModuleName = await prompt.getUserSelectedValue('apiName','Simplicite: Type in the api module name', 'moduleName@instance.url');
	// 		const module = moduleHandler.getApiModuleFromApiName(apiModuleName);
	// 		if (!module) throw new Error('');
	// 		prompt.addElement('apiName', apiModuleName);
	// 		WorkspaceController.removeApiFileSystemFromWorkspace(module);
	// 		WorkspaceController.deleteModuleAndFiles(module, moduleHandler, barItem);
	// 	} catch(e: any) {
	// 		logger.error(e);
	// 		if(e.message !== 'Simplicité: input cancelled') window.showInformationMessage('Simplicite: ' + e.message ? e.message : e);
	// 	}
	// });
	
	// ------------------------------

	// public command can be used by other dev if needed
	const publicCommand = [login, logout, logIntoInstance, logoutFromInstance, applyChanges, applySpecificInstance, applySpecificModule];
	// private commands are needed for the tree views, it's not relevant to expose them
	const privateCommand = [copyLogicalName, copyPhysicalName, copyJsonName];
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

// async function trackAction(fileHandler: FileHandler, modules: Module[], element: FileItem, trackedValue: boolean) {
// 	const file = await getInputFile(fileHandler, element);
// 	await fileHandler.setTrackedStatus(file.uri, trackedValue, modules);
// }

// async function getInputFile(fileHandler: FileHandler, element: FileItem): Promise<File> {
// 	if (!element.resourceUri) {
// 		const input = await simpleInput('Simplicite: Type in the file\'s absolute path', 'path');
// 		return fileHandler.getFileFromFullPath(input);
// 	} else {
// 		return fileHandler.getFileFromFullPath(element.resourceUri.path);		
// 	}
// }






