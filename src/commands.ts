'use strict';

import { commands, window } from 'vscode';
import { logger } from './Log';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
const copyToClipBoard = require('copy-paste').copy;

export const loginAllModulesCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.logIn', async () => {	
    await request.loginHandler();
    //request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
    });
};
export const applyChangesCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.applyChanges', async function () {
		try {
			await request.applyChangesHandler();
		} catch (e) {
			logger.error(e);
		}
		//request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
};
export const logoutCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.logOut', function () {	
		request.logout();
		//request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
};
export const connectedInstanceCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.connectedInstance', function () {	
		request.connectedInstance();
	});
};
export const logoutFromModuleCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.logOutFromInstance', async function () {	
		try {
            const input = await window.showInputBox({ 
                placeHolder: 'module name',  
                title: 'Simplicite: Type the name of the module'
            });
            if (!input) {
                throw 'Simplicite: Action canceled';
            }
			await request.specificLogout(input);
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
                throw 'Simplicite: Action canceled';
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
                    throw '';
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
                await request.loginTokenOrCredentials(module);
            } 
			if (!flag) {
                throw `Simplicite: There is no module ${moduleName} in your current workspace`;
            } 
        } catch (e: any) {
			logger.error(e);
            window.showInformationMessage(e.message ? e.message : e);
        }
		//request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
};
export const compileWorkspaceCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.compileWorkspace', async function () {
		try {
			await request.compileJava();
            logger.info('Compilation succeeded');
		} catch (e) {
            logger.error(e);
		}
		
	});
};

export const fieldToClipBoardCommand = function () {
    return commands.registerCommand('simplicite-vscode.fieldToClipBoard', element => {
        if (element !== undefined) {
            copyToClipBoard(element);
        }
    });
};
