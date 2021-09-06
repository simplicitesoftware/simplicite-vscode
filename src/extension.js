'use strict';

const vscode = require('vscode');
const { SimpliciteAPIManager } = require('./SimpliciteAPIManager');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	let request = new SimpliciteAPIManager();
	let modules = await request.fileHandler.getSimpliciteModules();
	let modulesLength = modules.length; // useful to compare module change on onDidChangeWorkspaceFolders

	vscode.workspace.onDidSaveTextDocument(async (event) => {
		if (event.uri.path.search('.java') !== -1) {
			await request.fileHandler.setfileList(modules, event.uri);
			request.barItem.show(request.fileHandler.fileList, modules, request.moduleURLList);
		}
	})

	request.fileHandler.getModifiedFilesOnStart();

	request.barItem.show(request.fileHandler.fileList, modules, request.moduleURLList);

	await request.loginHandler(modules);
	
	vscode.workspace.onDidChangeWorkspaceFolders(async (event) => { // The case where one folder is added and one removed should not happen
		request.barItem.show(request.fileHandler.fileList, modules, request.moduleURLList);
		const tempModules = await request.fileHandler.getSimpliciteModules();
		if (event.added.length > 0 && tempModules.length > modulesLength) { // If a folder is added to workspace and it's a simplicité module
			modulesLength = tempModules.length;
			try {
				await request.loginTokenOrCredentials(modules[modules.length - 1]); // We need to connect with the module informations
			} catch(e) {
				console.log(e);
			}
		} else if (event.removed.length > 0 && tempModules.length < modulesLength) { // in this case, if a folder is removed we check if it's a simplicite module
			await request.specificLogout(modules, event.removed[0].name);
			modulesLength = modules.length;
		}
		modules = await request.fileHandler.getSimpliciteModules();
		request.barItem.show(request.fileHandler.fileList, modules, request.moduleURLList);
	});

	// Commands has to be declared in package.json so VS Code knows that the extension provides a command
	const loginAllModules = vscode.commands.registerCommand('simplicite-vscode.logIn', async () => {	
		await request.loginHandler(modules);
		request.barItem.show(request.fileHandler.fileList, modules, request.moduleURLList);
	});

	const applyChanges = vscode.commands.registerCommand('simplicite-vscode.applyChanges', async function () {
		try {
			await request.applyChangesHandler();
			vscode.window.showInformationMessage('Simplicite: Successfully applied changes');
		} catch (e) {
			vscode.window.showErrorMessage(e.message ? e.message : e);
		}
		request.barItem.show(request.fileHandler.fileList, modules, request.moduleURLList);
	});

	const logout = vscode.commands.registerCommand('simplicite-vscode.logOut', function () {	
		request.logout();
		request.barItem.show(request.fileHandler.fileList, modules, request.moduleURLList);
	});

	const connectedInstance = vscode.commands.registerCommand('simplicite-vscode.connectedInstance', function () {	
		request.connectedInstance();
	});

	const logoutFromModule = vscode.commands.registerCommand('simplicite-vscode.logOutFromModule', async function () {	
		try {
            const moduleName = await vscode.window.showInputBox({ 
                placeHolder: 'module name',  
                title: 'Simplicite: Type the name of the module'
            });
            if (!moduleName) throw 'Simplicite: Action canceled';
			await request.specificLogout(modules, moduleName);
        } catch (e) {
            vscode.window.showInformationMessage(e.message ? e.message : e);
        }
		
	});

	const logInModule = vscode.commands.registerCommand('simplicite-vscode.logInModule', async function () {	
		try {
            const moduleName = await vscode.window.showInputBox({ 
                placeHolder: 'module name',  
                title: 'Simplicite: Type the name of the module'
            });
            if (!moduleName) throw 'Simplicite: Action canceled';
			let flag = false;
			for (let module of modules) {
				if (module.moduleInfo === moduleName) {
					await request.loginTokenOrCredentials(module);
					flag = true;
				}
			}
			if (!flag) throw `Simplicite: There is no module ${moduleName} in your current workspace`;
        } catch (e) {
            vscode.window.showInformationMessage(e.message ? e.message : e);
        }
		request.barItem.show(request.fileHandler.fileList, modules, request.moduleURLList);
	});

	const changedFileList =  vscode.commands.registerCommand('simplicite-vscode.changedFileList', async function () {
		console.log(request.fileHandler.fileList);
	});

	context.subscriptions.push(loginAllModules, applyChanges, logout, connectedInstance, logoutFromModule, logInModule, changedFileList); // All commands available
}

module.exports = {
	activate: activate
}
