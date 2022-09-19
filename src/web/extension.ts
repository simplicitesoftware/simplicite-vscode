'use strict';

import { ExtensionContext, env, debug, languages, Disposable, window, workspace } from 'vscode';
import { logger } from './Log';
import { BarItem } from './BarItem';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { QuickPick } from './QuickPick';
import { FileTree } from './treeView/FileTree';
import { FileService } from './FileService';
import { initGlobalValues } from './constants';
import { commandInit } from './commands';
import { SimpliciteInstanceController } from './SimpliciteInstanceController';
import { Prompt } from './Prompt';
import { WorkspaceController } from './WorkspaceController';

export async function activate(context: ExtensionContext): Promise<any> {
	logger.info('Starting extension on ' + env.appName + ' hosted on ' + env.appHost);
	initGlobalValues(context.globalStorageUri.path);
	

	//addFileTransportOnDesktop(STORAGE_PATH); // write a log file only on desktop context, on other contexts logs are written in the console
	const globalState = context.globalState;
	if(debug.activeDebugSession) {
		console.log('Api modules stored in memento', globalState.get(API_MODULES, []));
	}

	const prompt = new Prompt(globalState);

	const barItem = new BarItem();
	barItem.show([]);

	const moduleInfoTree = new ModuleInfoTree(context.extensionUri.path);

	const simpliciteInstanceController = new SimpliciteInstanceController(prompt, globalState, barItem);
	const publicCommand = commandInit(context, simpliciteInstanceController, prompt, context.globalState, moduleInfoTree);
	await simpliciteInstanceController.initAll();

	new QuickPick(context.subscriptions);

	const fileService = new FileService(simpliciteInstanceController);
	await fileService.fileListener();
		
	await WorkspaceController.workspaceFolderChangeListener(simpliciteInstanceController);

	window.registerTreeDataProvider('simpliciteModuleInfo', moduleInfoTree);

	if (!workspace.getConfiguration('simplicite-vscode-tools').get('api.sendFileOnSave')) {
		const fileTree = new FileTree(context.extensionUri.path, Array.from(simpliciteInstanceController.simpliciteInstances.values()));
		window.registerTreeDataProvider('simpliciteFile', fileTree);
	}

	return publicCommand;
}

// renderer process (which handles the memento) is unreliable at this point
// handling this case only on desktop where memento values are shared over VS Code instances
export function deactivate() {
	console.log('Simplicite VS Code extension deactivate');
	// if(env.appHost === 'desktop') {
	// 	await workspace.fs.delete(SESSION_ID_JSON);
	// }
	//globalState.update(API_MODULES, undefined);
	// session is closing, remove sessionId so the module can initiate in another instance
	// const savedMod = globalState.get(API_MODULES, []);
	// savedMod.forEach((ams: ApiModuleSave) => {
	// 	if(ams.sessionId === env.sessionId) ams.sessionId = undefined;
	// });
	// try {
	// 	await globalState.update(API_MODULES, savedMod);
	// 	logger.info('Successfully updated globalState on deactivate');
	// } catch(e) {
	// 	logger.error('Unable to update globalState on deactivate');
	// }
}


