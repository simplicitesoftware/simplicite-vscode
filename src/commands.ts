'use strict';

import { commands, window, env, Disposable, Uri, workspace } from 'vscode';
import { logger } from './Log';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { Module } from './Module';
import { File } from './File';
import { RFSControl } from './rfs/RFSControl';
import { ModuleHandler } from './ModuleHandler';
import { FileHandler } from './FileHandler';

// Commands are added in extension.ts into the vscode context
// Commands also need to to be declared as contributions in the package.json

// ------------------------------
// Apply commands
export const applyChangesCommand = function (request: SimpliciteAPIManager): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.applyChanges', async function () {
		try {
			await request.applyChangesHandler(undefined, undefined);
		} catch (e: any) {
			if (e !== '') {
				window.showErrorMessage(e.message ? e.message : e);
				logger.error(e);
			}

		}
	});
};

export const applySpecificModuleCommand = function (request: SimpliciteAPIManager, moduleHandler: ModuleHandler): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.applySpecificModule', async function (element: SimpliciteAPIManager | any) {
		try {
			// eslint-disable-next-line no-prototype-builtins
			if (!element.hasOwnProperty('label') && !element.hasOwnProperty('description')) {
				element = await inputFilePath('Simplicite: Type in the module name', 'module name');
				const moduleObject: Module | undefined = moduleHandler.getModuleFromName(element);
				if (!moduleObject) {
					const msg = 'Simplicite: Cannot find module or url ' + element;
					throw new Error(msg);
				}
				if (moduleObject instanceof Module) {
					await request.applyChangesHandler(moduleObject.name, moduleObject.instanceUrl);
				}
			} else {
				await request.applyChangesHandler(element.label, element.description);
			}
		} catch (e: any) {
			window.showErrorMessage(e.message);
			logger.error(e);
		}
	});
};

// ------------------------------
// Compiling commands
export const compileWorkspaceCommand = function (request: SimpliciteAPIManager): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.compileWorkspace', async function () {
		try {
			const status = await request.compileJava();
			logger.info(status);
		} catch (e) {
			logger.error(e);
		}

	});
};

// ------------------------------
// Authentication commands
export const loginIntoDetectedInstancesCommand = function (request: SimpliciteAPIManager, ): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.logIn', async () => {
		await request.loginHandler();
	});
};

export const logIntoSpecificInstanceCommand = function (request: SimpliciteAPIManager, moduleHandler: ModuleHandler): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.logIntoSpecificInstance', async function () {
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
			if (module && !moduleHandler.connectedInstancesUrl.includes(module.instanceUrl)) {
				await request.loginTokenOrCredentials(module);
			}
			if (!flag) {
				throw new Error(`Simplicite: Cannot find module or url ${moduleName}`);
			}
		} catch (e: any) {
			logger.error(e);
			window.showInformationMessage(e.message ? e.message : e);
		}
	});
};

export const logoutCommand = function (request: SimpliciteAPIManager): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.logOut', async function () {
		await request.logout();
	});
};

export const logoutFromSpecificInstanceCommand = function (request: SimpliciteAPIManager, moduleHandler: ModuleHandler): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.logOutFromInstance', async function () {
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
				await request.specificLogout(module.instanceUrl);
			}
			if (!flag) {
				throw new Error(`Simplicite: Cannot find module or url ${input}`);
			}

		} catch (e: any) {
			logger.error(e);
			window.showInformationMessage(e.message ? e.message : e);
		}
	});
};

// ------------------------------
// File handling commands
export const trackFileCommand = function (request: SimpliciteAPIManager, fileHandler: FileHandler, moduleHandler: ModuleHandler): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.trackFile', async function (element: any) {
		try {
			await trackAction(request, fileHandler, moduleHandler, element, true);
		} catch (e) {
			logger.error(e);
		}
	});
};

export const untrackFilesCommand = function (request: SimpliciteAPIManager, fileHandler: FileHandler, moduleHandler: ModuleHandler): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.untrackFile', async function (element: any) {
		try {
			await trackAction(request, fileHandler, moduleHandler, element, false);
		} catch (e) {
			logger.error(e);
		}
	});
};

// ------------------------------

export const refreshModuleTreeCommand = function (request: SimpliciteAPIManager): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.refreshModuleTree', async function () {
		await request.refreshModuleDevInfo();
	});
};

export const refreshFileHandlerCommand = function (fileHandler: FileHandler, moduleHandler: ModuleHandler): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.refreshFileHandler', async function () {
		if (fileHandler.fileTree) {
			const modules = moduleHandler.modules;
			fileHandler.fileList = await fileHandler.FileDetector(modules);
		}
	});
};

// ------------------------------
// Tree view commands
export const copyLogicalNameCommand = function (): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.copyLogicalName', (element) => {
		if (!element.label) {
			logger.error('cannot copy logical name: label is undefined');
		} else {
			env.clipboard.writeText(element.label);
		}
	});
};

export const copyPhysicalNameCommand = function (): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.copyPhysicalName', (element) => {
		if (!element.description) {
			logger.error('cannot copy copy physical name: description is undefined');
		} else {
			env.clipboard.writeText(element.description);
		}
	});
};

export const copyJsonNameCommand = function (): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.copyJsonName', (element) => {
		if (!element.additionalInfo) {
			logger.error('cannot copy jsonName: additionalInfo is undefined');
		} else {
			env.clipboard.writeText(element.additionalInfo);
		}
	});
};

export const itemDoubleClickTriggerCommand = function (moduleInfoTree: ModuleInfoTree): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.itemDoubleClickTrigger', (logicName: string) => {
		if (doubleClickTrigger()) {
			try {
				moduleInfoTree.insertFieldInDocument(logicName);
			} catch (e) {
				logger.error(e);
			}
		}
	});
};

// ------------------------------

export const connectToRemoteFileSystemCommand = function (moduleHandler: ModuleHandler, connectedInstances: string[], request: SimpliciteAPIManager): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.connectToRemoteFileSystem', async () => {
		try {
			const instanceUrl = await window.showInputBox({
				placeHolder: 'instance url',
				title: 'Simplicite: Type the name of the instance url'
			});
			if (!instanceUrl) {
				throw new Error();
			}
			const moduleName = await window.showInputBox({
				placeHolder: 'module name',
				title: 'Simplicite: Type the name of the module'
			});
			if (!moduleName) {
				throw new Error();
			}
			const module = new Module(moduleName, '', instanceUrl, '', true);
			if (moduleHandler.moduleLength() === 0) {
				moduleHandler.modules.push(module);
			} else {
				for (const mod of moduleHandler.modules) {
					if (mod.instanceUrl === module.instanceUrl && mod.name === module.name) {
						mod.remoteFileSystem = module.remoteFileSystem; // = true
					}
				}
			}
			if (!connectedInstances.includes(instanceUrl)) {
				await request.loginTokenOrCredentials(module);
			} else {
				request.RFSControl = new RFSControl(request.appHandler.getApp(instanceUrl), module, request.devInfo);
				await request.RFSControl.initAll(moduleHandler);
				console.log('created rfs from connectToRemoteFileSystemCommand');
			}
		} catch (e: any) {
			logger.error(e);
			window.showInformationMessage(e.message ? e.message : e);
		}
	});
};

export const disconnectRemoteFileSystemCommand = function (moduleHandler: ModuleHandler, request: SimpliciteAPIManager): Disposable {
	return commands.registerCommand('simplicite-vscode-tools.disconnectRemoteFileSystem', async () => {
		if (!request.RFSControl) {
			return;
		}
		await request.specificLogout(request.RFSControl.module.instanceUrl);
		for (const module of moduleHandler.modules) {
			if (module.remoteFileSystem) {
				module.remoteFileSystem = false;
			}
		}
		moduleHandler.saveModules();
	});
};

// ------------------------------

export const initApiWorkspaceCommand = function () {
	return commands.registerCommand('simplicite-vscode-tools.initApiWorkspace', (baseUrl: string) => {
		workspace.updateWorkspaceFolders(0, 0, { uri: Uri.parse(baseUrl), name: baseUrl });
	});
};

export const initApiFilesCommand = function (request: SimpliciteAPIManager) {
	return commands.registerCommand('simplicite-vscode-tools.initApiFiles', async () => {
		if (!request.RFSControl) {
			window.showErrorMessage('Simplicite: Cannot initialize the api files, run command "Simplicite: Connect to module remote file system" and make sure the workspace has been correctly set');
			return;
		}
		await request.RFSControl.initFiles();
	});
};

export const deleteApiWorkspaceCommand = function (request: SimpliciteAPIManager) {
	return commands.registerCommand('simplicite-vscode-tools.deleteApiWorkspace', async () => {
		if (!request.RFSControl) {
			window.showErrorMessage('Simplicite: Cannot delete api workspace because RFSControl is not set');
			return;
		}
		try {
			// implement the removal of the module workspace folder and delete the files
			// remove workspace first as resource is considered busy when opened in a workspace
			//const res = workspace.updateWorkspaceFolders(workspace.workspaceFolders ? workspace.workspaceFolders.length : 0, null, { uri: Uri.parse('D:\\Repositories\\Github\\Training'), name: 'mourir' });
			//const uri = Uri.parse(request.RFSControl.baseUrl);
			//const res = workspace.updateWorkspaceFolders(0, 1);
			//console.log(res);
			//await workspace.fs.delete(uri, { recursive: true });
		} catch (e) {
			logger.error(e);
		}
	});
};

// ------------------------------

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

async function trackAction(request: SimpliciteAPIManager, fileHandler: FileHandler, moduleHandler: ModuleHandler, element: any, trackedValue: boolean) {
	const inputFile = await getInputFile(request, element);
	const fileModule = fileHandler.bindFileAndModule(moduleHandler.modules);
	await fileHandler.setTrackedStatus(inputFile.filePath, trackedValue, fileModule);
}

async function getInputFile(request: SimpliciteAPIManager, element: any): Promise<File> {
	if (element.fullPath) {
		return request.fileHandler.getFileFromFullPath(element.fullPath);
	} else {
		const input = await inputFilePath('Simplicite: Type in the file\'s absolute path', 'path');
		return request.fileHandler.getFileFromFullPath(input);
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




