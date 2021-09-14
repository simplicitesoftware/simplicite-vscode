'use strict';

const { commands, window } = require('vscode');

const loginAllModulesCommand = function (request) {
    return commands.registerCommand('simplicite-vscode.logIn', async () => {	
    await request.loginHandler();
    request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
    });
}

const applyChangesCommand = function (request) {
    return commands.registerCommand('simplicite-vscode.applyChanges', async function () {
		try {
			await request.applyChangesHandler();
		} catch (e) {
			console.log(e);
		}
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
}

const logoutCommand = function (request) {
    return commands.registerCommand('simplicite-vscode.logOut', function () {	
		request.logout();
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
}
const connectedInstanceCommand = function (request) {
    return commands.registerCommand('simplicite-connectedInstance', function () {	
		request.connectedInstance();
	});
}
const logoutFromModuleCommand = function (request) {
    return commands.registerCommand('simplicite-vscode.logOutFromInstance', async function () {	
		try {
            const input = await window.showInputBox({ 
                placeHolder: 'module name',  
                title: 'Simplicite: Type the name of the module'
            });
            if (!input) throw 'Simplicite: Action canceled';
			await request.specificLogout(input);
        } catch (e) {
            window.showInformationMessage(e.message ? e.message : e);
        }
	});
}

const logInInstanceCommand = function (request) {
    return commands.registerCommand('simplicite-vscode.logInInstance', async function () {	
		try {
            const moduleName = await window.showInputBox({ 
                placeHolder: 'module name',  
                title: 'Simplicite: Type the name of the module'
            });
            if (!moduleName) throw 'Simplicite: Action canceled';
			let flag = false;
            let module;
            try {
                console.log(request.moduleHandler.getConnectedInstancesUrl());
                for (let moduleLoop of request.moduleHandler.getModules()) {
                    if (moduleLoop.getInstanceUrl() === moduleName) {
                        module = moduleLoop;
                        flag = true;
                    }
                }
                if (module === undefined) throw '';
            } catch (e) {
                for (let moduleLoop of request.moduleHandler.getModules()) {
                    if (moduleLoop.getName() === moduleName) {
                        module = moduleLoop;
                        flag = true;
                    }
                }
            }
			await request.loginTokenOrCredentials(module);
			if (!flag) throw `Simplicite: There is no module ${moduleName} in your current workspace`;
        } catch (e) {
            window.showInformationMessage(e.message ? e.message : e);
        }
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
}

const compileWorkspaceCommand = function (request) {
    return commands.registerCommand('simplicite-vscode.compileWorkspace', async function () {
		try {
			await request.compileJava();
		} catch (e) {
			console.log(e);
		}
		
	});
}

module.exports = {
    loginAllModulesCommand: loginAllModulesCommand,
    applyChangesCommand: applyChangesCommand,
    logoutCommand: logoutCommand,
    connectedInstanceCommand: connectedInstanceCommand,
    logoutFromModuleCommand: logoutFromModuleCommand,
    logInInstanceCommand: logInInstanceCommand,
    compileWorkspaceCommand: compileWorkspaceCommand
}