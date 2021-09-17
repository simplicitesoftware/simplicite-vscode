'use strict';

const logger = require('./Log');
const { window, languages, commands, workspace, ExtensionContext, env } = require('vscode');
const { SimpliciteAPIManager } = require('./SimpliciteAPIManager');
const { CompletionHandler } = require('./CompletionHandler');
const { loginAllModulesCommand, applyChangesCommand, logoutCommand, connectedInstanceCommand, logoutFromModuleCommand, logInInstanceCommand, compileWorkspaceCommand } = require('./commands');

/**
 * @param {ExtensionContext} context
 */
async function activate(context) {
	// Api initialization
	logger.info('Starting extension...');
	logger.info('env appName: ' + env.appName);
	let request = new SimpliciteAPIManager();
	await request.init(context); // all the asynchronous affectation happens there
	let modulesLength = request.moduleHandler.moduleLength(); // useful to compare module change on onDidChangeWorkspaceFolders

	// Commands has to be declared in package.json so VS Code knows that the extension provides a command
	const loginAllModules = loginAllModulesCommand(request);
	const applyChanges = applyChangesCommand(request);
	const logout = logoutCommand(request);
	const connectedInstance = connectedInstanceCommand(request);
	const logoutFromModule = logoutFromModuleCommand(request);
	const logInInstance = logInInstanceCommand(request);
	const compileWorkspace = compileWorkspaceCommand(request);
	context.subscriptions.push(loginAllModules, applyChanges, logout, connectedInstance, logoutFromModule, logInInstance, compileWorkspace);

	// On save file detection
	workspace.onDidSaveTextDocument(async (event) => {
		if (event.uri.path.search('.java') !== -1) {
			await request.fileHandler.setFileList(request.moduleHandler.getModules(), event.uri);
			request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
		}
	})

	request.fileHandler.getModifiedFilesOnStart();
	request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	if(!workspace.getConfiguration('simplicite-vscode').get('disableAutoConnect')) {
		try {
			await request.loginHandler();
			request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
			logger.info('Automatic authentication succeeded');
		} catch (e) {
			logger.error(e);
		}
	};
		
	// Completion initialization 
	// This step needs to be executed after the first login as it's going to fetch the fields from the simplicite API
	const provider = new CompletionHandler(request);
	await provider.asyncInit();
	const completionProviderSingleQuote = languages.registerCompletionItemProvider(provider.template, provider, '"');
	const completionProviderDoubleQuote = languages.registerCompletionItemProvider(provider.template, provider, '\'');
	context.subscriptions.push(completionProviderSingleQuote, completionProviderDoubleQuote);

	// workspace handler
	workspace.onDidChangeWorkspaceFolders(async (event) => { // The case where one folder is added and one removed should not happen
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
		const tempModules = await request.fileHandler.getSimpliciteModules();
		if (event.added.length > 0 && tempModules.length > modulesLength) { // If a folder is added to workspace and it's a simplicité module
			logger.info('added workspace');
			modulesLength = tempModules.length;
			try {
				await request.loginTokenOrCredentials(request.moduleHandler.getModules()[request.moduleHandler.moduleLength() - 1]); // We need to connect with the module informations
			} catch(e) {
				logger.error(e);
			}
		} else if (event.removed.length > 0 && tempModules.length < modulesLength) { // in this case, if a folder is removed we check if it's a simplicite module
			logger.info('removed workspace');
			await request.specificLogout(event.removed[0].name);
			modulesLength = request.moduleHandler.moduleLength();
		}
		request.moduleHandler.setModules(await this.fileHandler.getSimpliciteModules());
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
}

module.exports = {
	activate: activate
}
