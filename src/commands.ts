'use strict';

import { commands, window } from 'vscode';
import { logger } from './Log';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { copy } from 'copy-paste';
import { ObjectInfoTree } from './treeView/ObjectInfoTree';
import { crossPlatformPath } from './utils';
import { Module } from './Module';
import { File } from './File';

// All these commands are added in extension.ts into the vscode context
// These also have to be declared as contributions in the package.json

// ------------------------------
// Apply commands
export const applyChangesCommand = function (request: SimpliciteAPIManager) {
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

export const applySpecificModuleCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode-tools.applySpecificModule', async function (element: SimpliciteAPIManager | any) {
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
        } catch (e: any) {
            window.showErrorMessage(e.message);
            logger.error(e);
        }
    });
};

// ------------------------------
// Compiling commands
export const compileWorkspaceCommand = function (request: SimpliciteAPIManager) {
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
export const loginIntoDetectedInstancesCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode-tools.logIn', async () => {	
        await request.loginHandler();
    });
};

export const logIntoSpecificInstanceCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode-tools.logIntoSpecificInstance', async function () {	
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
	});
};

export const logoutCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode-tools.logOut', function () {	
		request.logout();
	});
};

export const logoutFromSpecificInstanceCommand = function (request: SimpliciteAPIManager, fieldObjectTreeRefresh: () => Promise<void>, fieldObjectTree: ObjectInfoTree) {
    return commands.registerCommand('simplicite-vscode-tools.logOutFromInstance', async function () {	
		try {
            const input = await window.showInputBox({ 
                placeHolder: 'module name',
                title: 'Simplicite: Type the name of the module'
            });
            if (!input) {
                throw new Error('Simplicite: Action canceled');
            }
			await request.specificLogout(input, fieldObjectTreeRefresh, fieldObjectTree);
        } catch (e: any) {
			logger.error(e);
            window.showInformationMessage(e.message ? e.message : e);
        }
	});
};

// ------------------------------
// File handling commands
export const trackFileCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode-tools.trackFile', async function (element: any) {
        try {
            await trackAction(request, element, true);            
        } catch (e) {
            logger.error(e);
        }
    });
};

export const untrackFilesCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode-tools.untrackFile', async function (element: any) {
        try {
            await trackAction(request, element, false);            
        } catch (e) {
            logger.error(e);
        }
    });
};

// ------------------------------
// Tree view commands
export const labelToClipBoardCommand = function () {
    return commands.registerCommand('simplicite-vscode-tools.labelToClipBoard', element => {
        if (element !== undefined) {
            copy(element.label);
        }
    });
};

export const descriptionToClipBoardCommand = function () {
    return commands.registerCommand('simplicite-vscode-tools.descriptionToClipBoard', element => {
        if (element !== undefined) {
            copy(element.description);
        }
    });
};

// ------------------------------

async function trackAction (request: SimpliciteAPIManager, element: any, trackedValue: boolean) {
    const inputFile = await getInputFile(request, element);
    const fileModule = request.fileHandler.bindFileAndModule(request.moduleHandler.getModules());
    await request.fileHandler.setTrackedStatus(inputFile.getFilePath(), trackedValue, fileModule);                 
    request.barItem!.show(request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
}

async function getInputFile (request: SimpliciteAPIManager, element: any): Promise<File> {
    if (element.fullPath) {
        return request.fileHandler.getFileFromInput(element.fullPath);
    } else {
        const input = await inputFilePath('Simplicite: Type in the file path or name', 'path or name (ex: Demo.java or just Demo)');
        return request.fileHandler.getFileFromInput(input);
    }
}

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


