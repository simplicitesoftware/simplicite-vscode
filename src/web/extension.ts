'use strict';

import { ExtensionContext, env, debug, Disposable, window, workspace, commands } from 'vscode';
import { BarItem } from './BarItem';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { QuickPick } from './QuickPick';
import { FileTree } from './treeView/FileTree';
import { fileService } from './FileService';
import { initGlobalValues } from './constants';
import { initCommands } from './commands';
import { SimpliciteInstanceController } from './SimpliciteInstanceController';
import { Prompt } from './Prompt';
import { WorkspaceController } from './WorkspaceController';
import { completionProviderService } from './CompletionService';

export async function activate(context: ExtensionContext): Promise<any> {
	console.log('Starting extension on ' + env.appName + ' hosted on ' + env.appHost);
	initGlobalValues(context.globalStorageUri.path);
	
	const globalState = context.globalState;

	const prompt = new Prompt(globalState);

	const barItem = new BarItem();
	barItem.show([]);

	const moduleInfoTree = new ModuleInfoTree(context.extensionUri.path);
	const fileTree = new FileTree(context.extensionUri.path);
	window.registerTreeDataProvider('simpliciteFile', fileTree);

	const simpliciteInstanceController = new SimpliciteInstanceController(prompt, globalState, barItem);
	const publicCommand = initCommands(context, simpliciteInstanceController, prompt, context.globalState, fileTree, moduleInfoTree);

	window.registerTreeDataProvider('simpliciteModuleInfo', moduleInfoTree);

	try {
		await simpliciteInstanceController.initAll();
	} catch(e) {
		console.error(e);
	}

	new QuickPick(context.subscriptions);

	fileService(simpliciteInstanceController);
	
	await WorkspaceController.workspaceFolderChangeListener(simpliciteInstanceController);

	await completionProviderService(simpliciteInstanceController, context);	
	
	return publicCommand;
}

// renderer process (which handles the memento) is unreliable at this point
// handling this case only on desktop where memento values are shared over VS Code instances
export function deactivate() {
	console.log('Simplicite VS Code extension deactivate');
}


