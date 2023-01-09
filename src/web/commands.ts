'use strict';

import { commands, env, workspace, ExtensionContext, Memento, Uri } from 'vscode';
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
export const initCommands = function (context: ExtensionContext, simpliciteInstanceController: SimpliciteInstanceController, prompt: Prompt, globalState: Memento, fileTree: FileTree | undefined, moduleInfoTree: ModuleInfoTree) {

	const publicCommand = new Array().concat(getApplyCommands(simpliciteInstanceController, prompt),
		getAuthenticationCommands(simpliciteInstanceController, prompt),
		getTreeViewCommands(simpliciteInstanceController, moduleInfoTree, fileTree, globalState),
		getApiModuleCommands(prompt, simpliciteInstanceController),
		getOtherCommands(prompt, globalState, simpliciteInstanceController));

	// public command can be used by other dev if needed
	// private commands are needed for the tree views, it's not relevant to expose them
	const privateCommand = getPrivateCommands(globalState, simpliciteInstanceController, moduleInfoTree);
	context.subscriptions.push(...publicCommand, ...privateCommand);
	return publicCommand;
};

function getApplyCommands(simpliciteInstanceController: SimpliciteInstanceController, prompt: Prompt): Array<any> {

	const applyChanges = commands.registerCommand('simplicite-vscode-tools.applyChanges', async function () {
		await simpliciteInstanceController.sendAllFiles();
	});

	const applySpecificInstance = commands.registerCommand('simplicite-vscode-tools.applySpecificInstance', async function () {
		try {
			const instanceUrl = await prompt.getUserSelectedValue('url' ,'Simplicite: Type in the instance url', 'instance url');
			await simpliciteInstanceController.sendInstanceFilesOnCommand(instanceUrl);
			await prompt.addElement('url', instanceUrl);
		} catch(e) {
			console.error(e);
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
			console.error(e);
		}
	});

	return [applyChanges, applySpecificInstance, applySpecificModule];
}

function getAuthenticationCommands(simpliciteInstanceController: SimpliciteInstanceController, prompt: Prompt) {
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
      console.error(e);
    }
	});

	const logoutFromInstance = commands.registerCommand('simplicite-vscode-tools.logoutFromInstance', async function () {
		try {
      const instanceUrl = await prompt.getUserSelectedValue('url', 'Simplicite: Type the url of the Simplicité instance', 'instance url');
      await simpliciteInstanceController.logoutInstance(instanceUrl);
			await prompt.addElement(PromptValue.url, instanceUrl);
		} catch(e) {
      console.error(e);
    }
	});

	return [login, logout, logIntoInstance, logoutFromInstance];
}

function getTreeViewCommands(simpliciteInstanceController: SimpliciteInstanceController, moduleInfoTree: ModuleInfoTree, fileTree: FileTree | undefined, globalState: Memento) {
	const refreshModuleTree = commands.registerCommand('simplicite-vscode-tools.refreshModuleTree', async function () {
		moduleInfoTree.refresh(simpliciteInstanceController.devInfo, simpliciteInstanceController.getAllModules());
	});
	
	const refreshFileHandler = commands.registerCommand('simplicite-vscode-tools.refreshFileHandler', async function () {
		if(fileTree) fileTree.refresh(Array.from(simpliciteInstanceController.simpliciteInstances.values()));
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

	return [refreshModuleTree, refreshFileHandler, setTrackedFile, unsetTrackedFile];
}

function getApiModuleCommands(prompt: Prompt, simpliciteInstanceController: SimpliciteInstanceController) {
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
			console.error(e);
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
			console.error(e);
		}
	});

	return [removeApiModule, initApiModule];
}


function getOtherCommands(prompt: Prompt, globalState: Memento, simpliciteInstanceController: SimpliciteInstanceController) {
	//------------------------------
	// Compiling commands
	const compileWorkspace = commands.registerCommand('simplicite-vscode-tools.compileWorkspace', async function () {
		try {
			await compileJava();
		} catch (e) {
			console.error(e);
		}
	});
	
	// ------------------------------
	// Reset prompt cache
	const resetPromptCache = commands.registerCommand('simplicite-vscode-tools.resetPromptCache', async () => {
		prompt.resetValues();
	});

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
			} catch(e: any) {
				console.error(e.message);
			}
		} catch(e: any) {
			console.error(e.message);	
		}
	});

	return [compileWorkspace, resetPromptCache, resetExtensionData];
}

function getPrivateCommands(globalState: Memento, simpliciteInstanceController: SimpliciteInstanceController, moduleInfoTree: ModuleInfoTree) {
	const copyLogicalName = commands.registerCommand('simplicite-vscode-tools.copyLogicalName', (element) => {
		if (!element.label) {
			console.error('cannot copy logical name: label is undefined');
		} else {
			env.clipboard.writeText(element.label);
		}
	});

	const copyPhysicalName = commands.registerCommand('simplicite-vscode-tools.copyPhysicalName', (element) => {
		if (!element.description) {
			console.error('cannot copy copy physical name: description is undefined');
		} else {
			env.clipboard.writeText(element.description);
		}
	});

	const copyJsonName = commands.registerCommand('simplicite-vscode-tools.copyJsonName', (element) => {
		if (!element.additionalInfo) {
			console.error('cannot copy jsonName: additionalInfo is undefined');
		} else {
			env.clipboard.writeText(element.additionalInfo);
		}
	});

	// enable debug command if in development, see command when clause in package.json
	// inconstant behavior in debug env, need to test on production
	const nodeEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';    
	commands.executeCommand('setContext', 'simplicite-vscode-tools.NODE_ENV', nodeEnv);
	const debug = commands.registerCommand('simplicite-vscode-tools.debug', async () => {		
		const _savedModules = globalState.get(API_MODULES);
		const _authenticationStorage = globalState.get(AUTHENTICATION_STORAGE);
		const _trackedFiles = [];
		for (const instance of simpliciteInstanceController.simpliciteInstances.values()) {
			_trackedFiles.push(instance.getTrackedFiles());
		}
	});

	const itemDoubleClickTrigger = commands.registerCommand('simplicite-vscode-tools.itemDoubleClickTrigger', (logicName: string) => {
		if (doubleClickTrigger()) {
			try {
				moduleInfoTree.insertFieldInDocument(logicName);
			} catch (e) {
				console.error(e);
			}
		}
	});

	return [copyLogicalName, copyPhysicalName, copyJsonName, debug, itemDoubleClickTrigger];
}

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






