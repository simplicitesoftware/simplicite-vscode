'use strict';

import { commands, window } from 'vscode';
import { logger } from './Log';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { copy } from 'copy-paste';
import { FieldObjectTree } from './FieldObjectTree';

export const loginAllModulesCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.logIn', async () => {	
        await request.loginHandler();
    });
};
export const applyChangesCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.applyChanges', async function () {
		try {
			await request.applyChangesHandler();
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
	});
};
export const connectedInstanceCommand = function (request: SimpliciteAPIManager) {
    return commands.registerCommand('simplicite-vscode.connectedInstance', function () {	
		request.connectedInstance();
	});
};
export const logoutFromModuleCommand = function (request: SimpliciteAPIManager, fieldObjectTreeRefresh: () => Promise<void>, fieldObjectTree: FieldObjectTree) {
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
