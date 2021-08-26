'use strict';

const vscode = require('vscode');
const { FileHandler } = require('./FileHandler');
const { SimpliciteAPIManager } = require('./SimpliciteAPIManager');
const utils = require('./utils');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	let fileHandler = new FileHandler();
	let request = new SimpliciteAPIManager(fileHandler);
	let modules = await request.fileHandler.getSimpliciteModules();
	let modulesLength = modules.length; // useful to compare module change on onDidChangeWorkspaceFolders

	await request.loginHandler(modules);
		
	// check when workspace are being added
	// weird behavior, the extension development host might be responsible
	// maybe logout when simplicite's project folder is closed ?
	vscode.workspace.onDidChangeWorkspaceFolders(async (event) => { // The case where one folder is added and one removed should not happen
		modules = await request.fileHandler.getSimpliciteModules();
		if (event.added.length > 0 && modules.length > modulesLength) { // If a folder is added to workspace and it's a simplicité module
			modulesLength = modules.length;
			try {
				await request.login(modules[modules.length - 1]); // We need to connect with the module informations
			} catch(e) {
				console.log(e);
			}
			
		} else if (event.removed.length > 0 && modules.length < modulesLength) { // in this case, if a folder is removed we check if it's a simplicite module
			// if simplicite module removed then we need to adjust moduleLength
			modulesLength = modules.length;
		}
		
	})

	// Operation on fileList, to get track of changes
	const watcher = vscode.workspace.createFileSystemWatcher('**/src/**');
	let fileList = new Array();
	watcher.onDidChange(uri => {
		let filePath = request.fileHandler.crossPlatformPath(uri.path);
		for (let module of modules) {
			if (filePath.toLowerCase().includes(module.workspaceFolderPath.toLowerCase()) && !utils.isFileInFileList(fileList, filePath)) {
				fileList.push({ filePath: filePath, instanceUrl: module.moduleUrl });
			}
		}
		console.log(`Change detected: ${request.fileHandler.crossPlatformPath(filePath)}`);
	});

	// Commands has to be declared in package.json so VS Code knows that the extension provides a command
	let authenticate = vscode.commands.registerCommand('simplicite-vscode.login', async () => {	
		await request.loginHandler(modules);
	});	
	let synchronize = vscode.commands.registerCommand('simplicite-vscode.synchronize', async function () {
		try {
			await request.synchronizeHandler(fileList);
			fileList = new Array();
		} catch (e) {
			if (e.message === undefined) vscode.window.showInformationMessage(e);
			else vscode.window.showInformationMessage(e.message);
		}
	});
	let logout = vscode.commands.registerCommand('simplicite-vscode.logout', function () {	
		request.logout();
	});
	let connectedInstance = vscode.commands.registerCommand('simplicite-vscode.connectedInstance', function () {	
		request.connectedInstance();
	});
	let logoutFromModule = vscode.commands.registerCommand('simplicite-vscode.logoutFromModule', async function () {	
		await request.specificLogout({moduleInfo: 'Demo', moduleUrl: 'https://gaubert.demo.simplicite.io'});
	});
	context.subscriptions.push(authenticate, synchronize, logout, connectedInstance, logoutFromModule); // All commands available
}

module.exports = {
	activate: activate
}
