'use strict';

import { logger } from './Log';
import { workspace, ExtensionContext, TextDocument, WorkspaceFoldersChangeEvent, env, languages, window, commands } from 'vscode';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { CompletionHandler } from './CompletionHandler';
import { loginAllModulesCommand, applyChangesCommand, logoutCommand, connectedInstanceCommand, logoutFromModuleCommand, logInInstanceCommand, compileWorkspaceCommand, fieldToClipBoardCommand } from './commands';
import { BarItem } from './BarItem';
import { FieldObjectTree } from './FieldObjectTree';

export async function activate(context: ExtensionContext) {
	logger.info('Starting extension on ' + env.appName);
	const request = await SimpliciteAPIManager.build();
	let modulesLength = request.moduleHandler.moduleLength(); // useful to compare module change on onDidChangeWorkspaceFolders
	const barItem = await BarItem.build('Simplicite', context, request);
	request.setBarItem(barItem);
	barItem.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	const fieldObjectTree = new FieldObjectTree(request);
	window.registerTreeDataProvider(
		'simpliciteObjectFields',
		fieldObjectTree
	);
	commands.registerCommand('simplicite-vscode.refreshTreeView', async () => await fieldObjectTree.refresh());

	// Commands has to be declared in package.json so VS Code knows that the extension provides a command
	const loginAllModules = loginAllModulesCommand(request);
	const applyChanges = applyChangesCommand(request);
	const logout = logoutCommand(request);
	const connectedInstance = connectedInstanceCommand(request);
	const logoutFromModule = logoutFromModuleCommand(request, fieldObjectTree.refresh, fieldObjectTree);
	const logInInstance = logInInstanceCommand(request);
	const compileWorkspace = compileWorkspaceCommand(request);
	const fieldToClipBoard = fieldToClipBoardCommand();
	context.subscriptions.push(loginAllModules, applyChanges, logout, connectedInstance, logoutFromModule, logInInstance, compileWorkspace, fieldToClipBoard);

	// On save file detection
	workspace.onDidSaveTextDocument(async (event: TextDocument) => {
		if (event.uri.path.search('.java') !== -1) {
			request.fileHandler.setFileList(request.moduleHandler.getModules(), event.uri);
			barItem.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
		}
	});

	if(!workspace.getConfiguration('simplicite-vscode').get('disableAutoConnect')) {
		try {
			await request.loginHandler();
			barItem.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
		} catch (e) {
			logger.error(e);
		}
	};
		
	// Completion initialization 
	// This step needs to be executed after the first login as it's going to fetch the fields from the simplicite API
	const provider = await CompletionHandler.build(request);
	const completionProviderSingleQuote = languages.registerCompletionItemProvider(provider.template, provider, '"');
	const completionProviderDoubleQuote = languages.registerCompletionItemProvider(provider.template, provider, '\'');
	context.subscriptions.push(completionProviderSingleQuote, completionProviderDoubleQuote);

	// workspace handler
	workspace.onDidChangeWorkspaceFolders(async (event: WorkspaceFoldersChangeEvent) => { // The case where one folder is added and one removed should not happen
		barItem.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
		const tempModules = await request.fileHandler.getSimpliciteModules();
		if (event.added.length > 0 && tempModules.length > modulesLength) { // If a folder is added to workspace and it's a simplicité module
			logger.info('added workspace');
			modulesLength = tempModules.length;
			try {
				await request.loginTokenOrCredentials(request.moduleHandler.getModules()[request.moduleHandler.moduleLength() - 1]); // We need to connect with the module informations
				await fieldObjectTree.refresh();
			} catch(e) {
				logger.error(e);
			}
		} else if (event.removed.length > 0 && tempModules.length < modulesLength) { // in this case, if a folder is removed we check if it's a simplicite module
			logger.info('removed workspace');
			await request.specificLogout(event.removed[0].name, fieldObjectTree.refresh, fieldObjectTree);
			modulesLength = request.moduleHandler.moduleLength();
		}
		request.moduleHandler.setModules(await request.fileHandler.getSimpliciteModules());
		barItem.show(request.fileHandler.getFileList(), request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
}
