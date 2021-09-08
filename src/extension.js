'use strict';

const vscode = require('vscode');
const { SimpliciteAPIManager } = require('./SimpliciteAPIManager');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	let request = new SimpliciteAPIManager();
	await request.init(); // all the asynchronous affectation happens there
	// let modules = await request.fileHandler.getSimpliciteModules();
	let modulesLength = request.moduleHandler.moduleLength(); // useful to compare module change on onDidChangeWorkspaceFolders

	//vscode.workspace.getConfiguration('simplicite-vscode').get('onSaveApply');

	vscode.workspace.onDidSaveTextDocument(async (event) => {
		if (event.uri.path.search('.java') !== -1) {
			await request.fileHandler.setFileList(request.moduleHandler.getModules(), event.uri);
			request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
		}
	})

	request.fileHandler.getModifiedFilesOnStart();

	request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	await request.loginHandler();
	request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	
	vscode.workspace.onDidChangeWorkspaceFolders(async (event) => { // The case where one folder is added and one removed should not happen
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
		const tempModules = await request.fileHandler.getSimpliciteModules();
		if (event.added.length > 0 && tempModules.length > modulesLength) { // If a folder is added to workspace and it's a simplicité module
			modulesLength = tempModules.length;
			try {
				await request.loginTokenOrCredentials(request.moduleHandler.getModules()[request.moduleHandler.moduleLength() - 1]); // We need to connect with the module informations
			} catch(e) {
				console.log(e);
			}
		} else if (event.removed.length > 0 && tempModules.length < modulesLength) { // in this case, if a folder is removed we check if it's a simplicite module
			await request.specificLogout(event.removed[0].name);
			modulesLength = request.moduleHandler.moduleLength();
		}
		request.moduleHandler.setModules(await this.fileHandler.getSimpliciteModules());
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});

	// Commands has to be declared in package.json so VS Code knows that the extension provides a command
	const loginAllModules = vscode.commands.registerCommand('simplicite-vscode.logIn', async () => {	
		await request.loginHandler();
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});

	const applyChanges = vscode.commands.registerCommand('simplicite-vscode.applyChanges', async function () {
		try {
			await request.applyChangesHandler();
		} catch (e) {
			vscode.window.showErrorMessage(e.message ? e.message : e);
		}
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});

	const logout = vscode.commands.registerCommand('simplicite-vscode.logOut', function () {	
		request.logout();
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});

	const connectedInstance = vscode.commands.registerCommand('simplicite-vscode.connectedInstance', function () {	
		request.connectedInstance();
	});

	const logoutFromModule = vscode.commands.registerCommand('simplicite-vscode.logOutFromInstance', async function () {	
		try {
            const moduleName = await vscode.window.showInputBox({ 
                placeHolder: 'module name',  
                title: 'Simplicite: Type the name of the module'
            });
            if (!moduleName) throw 'Simplicite: Action canceled';
			await request.specificLogout(moduleName);
        } catch (e) {
            vscode.window.showInformationMessage(e.message ? e.message : e);
        }
	});

	const logInInstance = vscode.commands.registerCommand('simplicite-vscode.logInInstance', async function () {	
		try {
            const moduleName = await vscode.window.showInputBox({ 
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
            vscode.window.showInformationMessage(e.message ? e.message : e);
        }
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
	const compileWorkspace = vscode.commands.registerCommand('simplicite-vscode.compileWorkspace', async function () {
		await request.compileJava();
	});


	context.subscriptions.push(loginAllModules, applyChanges, logout, connectedInstance, logoutFromModule, logInInstance, compileWorkspace); // All commands available
}

module.exports = {
	activate: activate
}
