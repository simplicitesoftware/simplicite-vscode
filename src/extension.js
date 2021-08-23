'use strict';

const vscode = require('vscode');
const { RequestManager } = require('./requestManager');
const utils = require('./utils');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	let request = new RequestManager();
	let modules = await utils.getSimpliciteModules();
	let modulesLength = modules.length;

	try {
		console.log(modules);

		const moduleURLList = new Array();
		for (let module of modules) { // check if moduleURL is in the list of the connected moduleUrl
			if (!module.isConnected && !moduleURLList.includes(module.moduleUrl)) { // if module not connected need to check if url has been connected with another module
				await request.login(module, moduleURLList);
				module.isConnected = true;
				moduleURLList.push(module.moduleUrl);
			} else if (!module.isConnected && moduleURLList.includes(module.moduleUrl)) {
				module.isConnected = true;
			}
			// console.log(module);
		}
	} catch (e) {
		console.log(e);
	}
	

	vscode.workspace.onDidChangeWorkspaceFolders(async (event) => { // The case where one folder is added and one removed should not happen
		console.log(event);
		modules = await utils.getSimpliciteModules();
		if (event.added.length > 0 && modules.length > modulesLength) { // If a folder is added to workspace and it's a simplicité module
			modulesLength = modules.length;
			await request.login(modules[modules.length - 1]); // We need to connect with the module informations
		} else if (event.removed.length > 0 && modules.length < modulesLength) { // in this case, if a folder is removed we check if it's a simplicite module
			// if simplicite module removed then we need to adjust moduleLength
			modulesLength = modules.length;
		}
		
	})

	// Operation on fileMap, to get track of changes
	const watcher = vscode.workspace.createFileSystemWatcher('**/src/**');
	const fileMap = new Array();
	watcher.onDidChange(uri => {
		let filePath = uri;
		if (!fileMap.includes(filePath)) fileMap.push({ filePath: filePath, instanceUrl: '' });
		console.log(`Change detected: ${utils.crossPlatformPath(filePath.path)}`);
	});

	// Commands has to be declared in package.json so VS Code knows that the extension provides a command
	let authenticate = vscode.commands.registerCommand('simplicite-vscode.login', async function () {	
		vscode.window.showInformationMessage('authenticate');
	});
	let synchronize = vscode.commands.registerCommand('simplicite-vscode.synchronize', function () {	
		request.synchronize(fileMap);
	});
	let logout = vscode.commands.registerCommand('simplicite-vscode.logout', function () {	
		request.logout();
	});
	context.subscriptions.push(authenticate, synchronize, logout); // All commands available
}




module.exports = {
	activate: activate
}
