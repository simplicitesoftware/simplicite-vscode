'use strict';

import { ExtensionContext, env, debug, Disposable, window, workspace, commands, Task, tasks } from 'vscode';
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
// import { UnitTestTaskProvider } from './UnitTestTaskProvider';

let fileTreeProvider: Disposable | undefined;
let moduleInfoTreeProvider: Disposable | undefined;
let unitTestTaskDisposible: Disposable | undefined;

export async function activate(context: ExtensionContext): Promise<any> {
	console.log('Starting extension on ' + env.appName + ' hosted on ' + env.appHost);
	initGlobalValues(context.globalStorageUri.path);
	
	const globalState = context.globalState;

	const prompt = new Prompt(globalState);

	context.subscriptions.push(commands.registerCommand(SHOW_SIMPLICITE_COMMAND_ID, async () => await QuickPick.quickPickEntry()));

	const barItem = new BarItem();
	barItem.show([]);

	const moduleInfoTree = new ModuleInfoTree(context.extensionUri.path);
	const fileTree = new FileTree(context.extensionUri.path);
	fileTreeProvider = window.registerTreeDataProvider('simpliciteFile', fileTree);

	const simpliciteInstanceController = new SimpliciteInstanceController(prompt, globalState, barItem);
	const publicCommand = initCommands(context, simpliciteInstanceController, prompt, context.globalState, fileTree, moduleInfoTree);

	moduleInfoTreeProvider = window.registerTreeDataProvider('simpliciteModuleInfo', moduleInfoTree);

	try {
		await simpliciteInstanceController.initAll();
	} catch(e) {
		console.error(e);
	}

	// add quick pick to subscriptions

	// unitTestTaskDisposible =  tasks.registerTaskProvider("simplicite", new UnitTestTaskProvider(simpliciteInstanceController));
	fileService(simpliciteInstanceController);
	
	await WorkspaceController.workspaceFolderChangeListener(simpliciteInstanceController);

	await completionProviderService(simpliciteInstanceController, context);	
	
	return publicCommand;
}

// renderer process (which handles the memento) is unreliable at this point
export function deactivate() {
	if(fileTreeProvider) {
		fileTreeProvider.dispose();
	}
	if(moduleInfoTreeProvider) {
		moduleInfoTreeProvider.dispose();
	}
	if(unitTestTaskDisposible) {
		unitTestTaskDisposible.dispose();
	}
	console.log('Simplicite VS Code extension deactivate');
}


