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
            const moduleName = await window.showInputBox({ 
                placeHolder: 'module name',  
                title: 'Simplicite: Type the name of the module'
            });
            if (!moduleName) throw 'Simplicite: Action canceled';
			await request.specificLogout(moduleName);
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
			for (let module of request.moduleHandler.getModules()) {
				if (module.getName() === moduleName) {
					await request.loginTokenOrCredentials(module);
					flag = true;
				}
			}
			if (!flag) throw `Simplicite: There is no module ${moduleName} in your current workspace`;
        } catch (e) {
            window.showInformationMessage(e.message ? e.message : e);
        }
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
}

const compileWorkspaceCommand = function (request) {
    return commands.registerCommand('simplicite-compileWorkspace', async function () {
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