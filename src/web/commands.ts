'use strict';

import { commands, env, workspace, ExtensionContext, Memento, Uri } from 'vscode';
import { logger } from './log';
import { isHttpsUri, isHttpUri } from 'valid-url';
import { Prompt, PromptValue } from './Prompt';
import { SimpliciteInstanceController } from './SimpliciteInstanceController';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { compileJava } from './utils';
import { FileItem, ModuleItem } from './treeView/treeViewClasses';
import { FileTree } from './treeView/FileTree';

// Commands are added in extension.ts into the vscode context
// Commands also need to to be declared as contributions in the package.json

// ------------------------------
// Apply commands
export const commandInit = function (context: ExtensionContext, simpliciteInstanceController: SimpliciteInstanceController, prompt: Prompt, globalState: Memento, moduleInfoTree: ModuleInfoTree, fileTree: FileTree | undefined) {

	const applyChanges = commands.registerCommand('simplicite-vscode-tools.applyChanges', async function () {
		await simpliciteInstanceController.sendAllFiles();
	});

	const applySpecificInstance = commands.registerCommand('simplicite-vscode-tools.applySpecificInstance', async function () {
		try {
			const instanceUrl = await prompt.getUserSelectedValue('url' ,'Simplicite: Type in the instance url', 'instance url');
			await simpliciteInstanceController.sendInstanceFilesOnCommand(instanceUrl);
			await prompt.addElement('url', instanceUrl);
		} catch(e) {
			logger.error(e);
		}
	});
	
	const applySpecificModule = commands.registerCommand('simplicite-vscode-tools.applySpecificModule', async function (info: ModuleItem) {
		try {
			let instanceUrl;
			let moduleName;
			if(info) {
				instanceUrl = info.description;
				moduleName = info.apiName ? info.apiName : info.label;
			}
			if(!instanceUrl) instanceUrl = await prompt.getUserSelectedValue('url' ,'Simplicite: Type in the instance url', 'instance url');
			if(!moduleName) moduleName = await prompt.getUserSelectedValue('name', 'Simplicite: Type in the module name', 'module name');
			await simpliciteInstanceController.sendModuleFilesOnCommand(moduleName, instanceUrl);
			await prompt.addElement('url', instanceUrl);
			await prompt.addElement('name', moduleName);
		} catch(e) {
			logger.error(e);
		}
	});
	
	//------------------------------
	// Compiling commands
	const compileWorkspace = commands.registerCommand('simplicite-vscode-tools.compileWorkspace', async function () {
		try {
			await compileJava();
		} catch (e) {
			logger.error(e);
		}
	});
	
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
			await prompt.addElement(PromptValue.url, instanceUrl);
    } catch(e) {
      logger.error(e);
    }
	});

	const logoutFromInstance = commands.registerCommand('simplicite-vscode-tools.logoutFromInstance', async function () {
		try {
      const instanceUrl = await prompt.getUserSelectedValue('url', 'Simplicite: Type the url of the Simplicité instance', 'instance url');
      await simpliciteInstanceController.logoutInstance(instanceUrl);
			await prompt.addElement(PromptValue.url, instanceUrl);
		} catch(e) {
      logger.error(e);
    }
	});
	
	// // ------------------------------
	// // Refresh Tree views commands
	const refreshModuleTree = commands.registerCommand('simplicite-vscode-tools.refreshModuleTree', async function () {
		moduleInfoTree.feedData(simpliciteInstanceController.devInfo, simpliciteInstanceController.getAllModules());
	});
	
	const refreshFileHandler = commands.registerCommand('simplicite-vscode-tools.refreshFileHandler', async function () {
		if(fileTree) fileTree.refresh(Array.from(simpliciteInstanceController.simpliciteInstances.values()));
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

	const setTrackedFile = commands.registerCommand('simplicite-vscode-tools.trackFile', (info: FileItem) => {
		const lowerPath = info.resourceUri.path.toLowerCase();
		globalState.update(lowerPath, true);
		if(fileTree) fileTree.refresh(Array.from(simpliciteInstanceController.simpliciteInstances.values()));
	});

	const unsetTrackedFile = commands.registerCommand('simplicite-vscode-tools.untrackFile', (info) => {
		const lowerPath = info.resourceUri.path.toLowerCase();
		globalState.update(lowerPath, undefined);
		if(fileTree) fileTree.refresh(Array.from(simpliciteInstanceController.simpliciteInstances.values()));
	});
	
	// ------------------------------
	
	const initApiModule = commands.registerCommand('simplicite-vscode-tools.initApiModule', async () => {
		try {
 			const instanceUrl = await prompt.getUserSelectedValue('url', 'Simplicite: Type the name of the instance base URL', 'instance url'); 
	 		if (!isHttpsUri(instanceUrl) && !isHttpUri(instanceUrl)) throw new Error(instanceUrl + ' is not a valid url');
			const moduleName = await prompt.getUserSelectedValue('name', 'Simplicite: Type the name of the module', 'module name');
			const res = await simpliciteInstanceController.createApiModule(instanceUrl, moduleName);
			if (res) {
				await prompt.addElement(PromptValue.url, instanceUrl);
				await prompt.addElement(PromptValue.name, moduleName);
			}
		} catch(e) {
			logger.error(e);
		}
	});
	
	const removeApiModule = commands.registerCommand('simplicite-vscode-tools.removeApiModule', async () => {
		try {
			const instanceUrl = await prompt.getUserSelectedValue('url', 'Simplicite: Type the name of the instance base URL', 'instance url'); 
	 		if (!isHttpsUri(instanceUrl) && !isHttpUri(instanceUrl)) throw new Error(instanceUrl + ' is not a valid url');
			const moduleName = await prompt.getUserSelectedValue('name', 'Simplicite: Type the name of the module', 'module name');
			const res = await simpliciteInstanceController.removeApiModule(moduleName, instanceUrl);
			if(res) {
				await prompt.addElement(PromptValue.url, instanceUrl);
				await prompt.addElement(PromptValue.name, moduleName);
			}
		} catch(e: any) {
			logger.error(e);
		}
	});
	
	// ------------------------------

	// RESET
	const resetExtensionData = commands.registerCommand('simplicite-vscode-tools.resetExtensionData', async () => {
		try {
			await globalState.update(API_MODULES, undefined);
			await globalState.update(AUTHENTICATION_STORAGE, undefined);
			for (const instance of simpliciteInstanceController.simpliciteInstances.values()) {
				for(let file of instance.getTrackedFiles()) {
					await globalState.update(file.uri.path.toLowerCase(), undefined);
				}
			}
			try {
				workspace.fs.delete(Uri.parse(STORAGE_PATH), {recursive: true});
			} catch(e) {
				logger.error(e);
			}
		} catch(e: any) {
			logger.error(e);	
		}
	});

	// enable debug command if in development, see command when clause in package.json
	// inconstant behavior in debug env, need to test on production
	let nodeEnv: String;
	process.env.NODE_ENV === 'production' ? nodeEnv = 'production' : nodeEnv = 'development';    
	commands.executeCommand('setContext', 'simplicite-vscode-tools.NODE_ENV', nodeEnv);
	const debug = commands.registerCommand('simplicite-vscode-tools.debug', async () => {		
		const _savedModules = globalState.get(API_MODULES);
		const _authenticationStorage = globalState.get(AUTHENTICATION_STORAGE);
		const _trackedFiles = [];
		for (const instance of simpliciteInstanceController.simpliciteInstances.values()) {
			_trackedFiles.push(instance.getTrackedFiles());
		}
	});

	// public command can be used by other dev if needed
	const publicCommand = [login, logout, logIntoInstance, logoutFromInstance, applyChanges, applySpecificInstance, applySpecificModule, 
		initApiModule, removeApiModule, resetPromptCache, refreshModuleTree, compileWorkspace, setTrackedFile, unsetTrackedFile, refreshFileHandler];
	// private commands are needed for the tree views, it's not relevant to expose them
	const privateCommand = [copyLogicalName, copyPhysicalName, copyJsonName, resetExtensionData, debug, itemDoubleClickTrigger];
	context.subscriptions.concat(publicCommand, privateCommand);
	return publicCommand;
};

let firstClickTime = new Date().getTime();

function doubleClickTrigger(): boolean {
	const doubleClickTime = 300;
	const currentTime = new Date().getTime();
	if ((currentTime - firstClickTime) <= doubleClickTime) {
		return true;
	} else {
		firstClickTime = new Date().getTime();
		return false;
	}
}






