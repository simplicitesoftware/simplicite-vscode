'use strict';

import { commands, Uri, window } from 'vscode';
import { logger } from './Log';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { copy } from 'copy-paste';
import { ObjectInfoTree } from './treeView/ObjectInfoTree';
import { crossPlatformPath } from './utils';
import { Module } from './Module';

export const loginAllModulesCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.logIn', async () => {	
        await request.loginHandler();
    });
};
export const applyChangesCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.applyChanges', async function () {
		try {
			await request.applyChangesHandler(undefined, undefined);
		    request.barItem!.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
		} catch (e: any) {
            if (e !== '') {
                window.showErrorMessage(e.message ? e.message : e);
                logger.error(e);
            }
            
		}
	});
};
export const logoutCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.logOut', function () {	
		request.logout();
		request.barItem!.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
};
export const logoutFromModuleCommand = function (request: SimpliciteAPIManager, fieldObjectTreeRefresh: () => Promise<void>, fieldObjectTree: ObjectInfoTree) {
    return commands.registerCommand('simplicite-vscode.logOutFromInstance', async function () {	
		try {
            const input = await window.showInputBox({ 
                placeHolder: 'module name',
                title: 'Simplicite: Type the name of the module'
            });
            if (!input) {
                throw new Error('Simplicite: Action canceled');
            }
			await request.specificLogout(input, fieldObjectTreeRefresh, fieldObjectTree);
		    request.barItem!.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
        } catch (e: any) {
			logger.error(e);
            window.showInformationMessage(e.message ? e.message : e);
        }
	});
};
export const logInInstanceCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.logInInstance', async function () {	
		try {
            const moduleName = await window.showInputBox({ 
                placeHolder: 'module name',  
                title: 'Simplicite: Type the name of the module'
            });
            if (!moduleName) {
                throw new Error('Simplicite: Action canceled');
            }
			let flag = false;
            let module;
            try {
                for (let moduleLoop of request.moduleHandler.getModules()) {
                    if (moduleLoop.getInstanceUrl() === moduleName) {
                        module = moduleLoop;
                        flag = true;
                    }
                }
                if (module === undefined) {
                    throw new Error('error no module LogInInstanceCommand');
                }
            } catch (e) {
                for (let moduleLoop of request.moduleHandler.getModules()) {
                    if (moduleLoop.getName() === moduleName) {
                        module = moduleLoop;
                        flag = true;
                    }
                }
            }
			if (module) {
                await request.loginTokenOrCredentials(module, true);
            } 
			if (!flag) {
                throw new Error(`Simplicite: There is no module ${moduleName} in your current workspace`);
            } 
        } catch (e: any) {
			logger.error(e);
            window.showInformationMessage(e.message ? e.message : e);
        }
        request.barItem!.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
};
export const compileWorkspaceCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.compileWorkspace', async function () {
		try {
			const status = await request.compileJava();
            logger.info(status);
		} catch (e) {
            logger.error(e);
		}
		
	});
};

export const itemLabelToClipBoardCommand = function () {
    return commands.registerCommand('simplicite-vscode.itemLabelToClipBoard', element => {
        if (element !== undefined) {
            copy(element.label);
        }
    });
};

export const descriptionToClipBoardCommand = function () {
    return commands.registerCommand('simplicite-vscode.descriptionToClipBoard', element => {
        if (element !== undefined) {
            copy(element.description);
        }
    });
};

export const dontApplyFilesCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.dontApplyFile', async function (element: any) {
        if (element.fullPath) {
            request.fileHandler.deleteFileRouter(element.fullPath, request.moduleHandler.getModules(), true);
            request.fileHandler.fileTree.setFileModule(request.fileHandler.bindFileAndModule(request.moduleHandler.getModules()));

        } else {
            const input = await inputFilePath('Simplicite: Type in the file path or name', 'path or name (ex: Demo.java or just Demo)');
            request.fileHandler.deleteFileRouter(input, request.moduleHandler.getModules(), true);
            request.fileHandler.fileTree.setFileModule(request.fileHandler.bindFileAndModule(request.moduleHandler.getModules()));
        }
        request.barItem!.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
    });
};

export const removeFileFromChangedCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.removeFileFromChangedFiles', async function (element: any) {
        if (element.fullPath) {
            request.fileHandler.deleteFileFromListAndDisk(element.fullPath, request.moduleHandler.getModules());
        } else {
            const input = await inputFilePath('Simplicite: Type in the file path or name', 'path or name (ex: Demo.java or just Demo)');
            request.fileHandler.deleteFileFromListAndDisk(input, request.moduleHandler.getModules());
        }
        request.barItem!.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
    });
};

export const addFileToChangedFilesCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.addFileToChangedFiles', async function (element: any) {
        if (element.fullPath) {
            request.fileHandler.setFileList(request.moduleHandler.getModules(), element.fullPath);            
        } else {
            const input = await inputFilePath('Simplicite: Type in the file path or name', 'path or name (ex: Demo.java or just Demo)');
            request.fileHandler.setFileList(request.moduleHandler.getModules(), input);            
        }
        request.barItem!.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
    });
};

export const applySpecificModuleCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.applySpecificModule', async function (element: SimpliciteAPIManager | any) {
        try  {
            if (!element.hasOwnProperty('label') && !element.hasOwnProperty('description')) {
                element = await inputFilePath('Simplicite: Type in the module name', 'module name');
                const moduleObject: Module | boolean = request.moduleHandler.getModuleFromName(element);
                if (!moduleObject) {
                    const msg = 'Simplicite: Cannot find module named ' + element;
                    throw new Error(msg);
                }
                if (moduleObject instanceof Module) {
                    await request.applyChangesHandler(moduleObject.getName(), moduleObject.getInstanceUrl());
                }
            } else {
                await request.applyChangesHandler(element.label, element.description);
            }
            request.barItem!.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
        } catch (e: any) {
            window.showErrorMessage(e.message);
            logger.error(e);
        }
    });
};

async function inputFilePath (title: string, placeHolder: string) {
    const fileInput = await window.showInputBox({ 
        placeHolder: placeHolder,  
        title: title
    });
    if (!fileInput) {
        throw new Error('Simplicite: file input cancelled');
    }
    return crossPlatformPath(fileInput);
}


