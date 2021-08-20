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
	for (let module of modules) {
		await request.login(module);
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

	// Operation on fileList, to get track of changes
	const watcher = vscode.workspace.createFileSystemWatcher('**/src/**');
	const fileList = new Array();
	watcher.onDidChange(uri => {
		let filePath = uri;
		if (!fileList.includes(filePath)) fileList.push(filePath);
		console.log(`Change detected: ${utils.crossPlatformPath(filePath.path)}`);
	});

	// Commands has to be declared in package.json so VS Code knows that the extension provides a command
	let authenticate = vscode.commands.registerCommand('simplicite-vscode.login', async function () {	
		vscode.window.showInformationMessage('authenticate');
	});
	let synchronize = vscode.commands.registerCommand('simplicite-vscode.synchronize', function () {	
		request.synchronize(fileList);
	});
	let logout = vscode.commands.registerCommand('simplicite-vscode.logout', function () {	
		request.logout();
	});
	context.subscriptions.push(authenticate, synchronize, logout); // All commands available
}




module.exports = {
	activate: activate
}
