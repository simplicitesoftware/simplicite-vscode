'use strict';

const vscode = require('vscode');
const { RequestManager } = require('./requestManager');
const utils = require('./utils');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	let request = new RequestManager();

	if(!request.authenticationWithToken()) { // if token does not exist, connect manually
		vscode.window.showInformationMessage('Sign into simplicite to activate the service', 'Sign in').then(click => {
			if (click == 'Sign in') {
				request.authenticationWithCredentials();
			}
		})
	}

	// check for simplicite module on the extension's activation (shortly after vscode launch)
	// let simpliciteWorkspace = await utils.getSimpliciteModules();
	// vscode.workspace.onDidChangeWorkspaceFolders(async () => {
	// 	simpliciteWorkspace = await utils.getSimpliciteModules();
	// });

	// Operation on fileList, to get track of changes
	const watcher = vscode.workspace.createFileSystemWatcher('**/src/**');
	const fileList = new Array();
	watcher.onDidChange(uri => {
		let filePath = uri;
		if (!fileList.includes(filePath)) fileList.push(filePath);
		console.log(`Change detected: ${utils.crossPlatformPath(filePath.path)}`);
	});

	// Commands has to be declared in package.json so VS Code knows that the extension provides a command
	let authenticate = vscode.commands.registerCommand('simplicite-vscode.login', function () {	
		request.authenticateCommandRouter();
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
