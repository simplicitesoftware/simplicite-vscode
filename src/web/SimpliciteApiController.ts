// /* eslint-disable @typescript-eslint/no-non-null-assertion */
// 'use strict';

// import { Module } from './Module';
// import { window, commands, workspace, extensions, env, Uri } from 'vscode';
// import { AppHandler } from './AppHandler';
// import { ModuleHandler } from './ModuleHandler';
// import { logger } from './Log';
// import { File } from './File';
// import { CustomMessage, Credentials } from './interfaces';
// import { ModuleInfoTree } from './treeView/ModuleInfoTree';
// import { isHttpsUri, isHttpUri } from 'valid-url';
// import { SimpliciteApi } from './SimpliciteApi';
// import { FileHandler } from './FileHandler';
// import { Buffer } from 'buffer';

// export class SimpliciteApiController {
// 	private _appHandler: AppHandler;
// 	private _moduleHandler: ModuleHandler;
// 	private _fileHandler: FileHandler;
// 	private _moduleInfoTree?: ModuleInfoTree; // has its own setter 
// 	private _simpliciteApi: SimpliciteApi;
// 	backendCompiling: boolean; // to prevent applying changes when backend compilation is not done
// 	conflictStatus: boolean;
// 	constructor(_moduleHandler: ModuleHandler, simpliciteApi: SimpliciteApi, _appHandler: AppHandler, fileHandler: FileHandler) {
// 		this._appHandler = _appHandler;
// 		this._moduleHandler = _moduleHandler;
// 		this._fileHandler = fileHandler;
// 		this.backendCompiling = false;
// 		this._simpliciteApi = simpliciteApi;
// 		this.conflictStatus = false;
// 	}
	
// 	// login to every module
// 	async loginAll(): Promise<void> {
// 		for (const module of this._moduleHandler.modules) {
// 			if (!isHttpsUri(module.instanceUrl) && !(isHttpUri(module.instanceUrl))) {
// 				window.showErrorMessage('Simplicite: ' + module.instanceUrl + ' is not a valid url');
// 				continue;
// 			}
// 			try {
// 				await this.tokenOrCredentials(module);
// 			} catch(e) {
// 				// todo
// 			}
// 		}
// 	}
	
// 	async tokenOrCredentials(module: Module): Promise<boolean> {
// 		if (module.connected) return true;
// 		let credentials: Credentials | undefined;
// 		let token = '';
// 		if (module.token === '') {
// 			credentials = await this.getCredentials(module);
// 		} else {
// 			token = module.token;
// 		}
// 		return await this.loginMethod(module, credentials, token);
// 	}
	
// 	private async loginMethod(module: Module, credentials: Credentials | undefined, token: string): Promise<boolean> {
// 		const instanceUrl = module.instanceUrl;
// 		const givenToken = await this._simpliciteApi.login(instanceUrl, credentials, token);
// 		if (!givenToken) {
// 			this._moduleHandler.spreadToken(instanceUrl, ''); // reset token
// 			this._appHandler.appList.delete(instanceUrl);
// 			this._moduleHandler.saveModules();
// 			return false;
// 		}
// 		await this._moduleHandler.loginModuleState(this._simpliciteApi, module, givenToken, this._fileHandler);
// 		this._moduleInfoTree?.feedData(this._simpliciteApi.devInfo, this._moduleHandler.modules);
// 		return true;
// 	} 
	
// 	private async getCredentials(module: Module): Promise<Credentials | undefined> {
// 		let usernamePlaceHolder = 'username';
// 		let passwordPlaceHolder = 'password';
// 		if (env.appHost !== 'desktop') {
// 			usernamePlaceHolder = `username (instance url: ${module.instanceUrl})`;
// 			passwordPlaceHolder = `password (instance url: ${module.instanceUrl})`;
// 		}
// 		const username = await window.showInputBox({
// 			placeHolder: usernamePlaceHolder,
// 			title: 'Simplicite: Authenticate to ' + module.name + ' API (' + module.instanceUrl + ')'
// 		});
// 		if (!username) {
// 			throw new Error('Simplicité: input cancelled');
// 		}
// 		const password = await window.showInputBox({
// 			placeHolder: passwordPlaceHolder,
// 			title: 'Simplicite: Authenticate to ' + module.name + ' API (' + module.instanceUrl + ')',
// 			password: true
// 		});
// 		if (!password) {
// 			throw new Error('Simplicité: input cancelled');
// 		}
// 		return { userName: username, password: password };
// 	}
	
// 	async logoutAll(): Promise<void> { // disconnect every instance
// 		this._appHandler.appList.forEach(async (app: any, key: string) => {
// 			await this.instanceLogout(key);
// 		});
// 	}
	
// 	async instanceLogout(instanceUrl: string): Promise<void> { // disconnect specific instance
// 		await this._simpliciteApi.logout(instanceUrl);
// 		this._moduleHandler.logoutModuleState(instanceUrl, this._moduleInfoTree!, this._simpliciteApi.devInfo);
// 		this._appHandler.appList.delete(instanceUrl);
// 	}
	
// 	async applyAll(modules: Module[]): Promise<void> { // Apply all files
// 		for (const mod of modules) {
// 			if (!mod.connected) continue;
// 			await this.applyFiles(mod, modules);
// 		}
// 	}
	
// 	async applyModuleFiles(module: Module, modules: Module[]): Promise<void> { // Apply the changes of a specific module
// 		if (!module.connected) {
// 			window.showWarningMessage('Simplicite: ' + module.name + ' is not connected');
// 			return;
// 		}
// 		await this.applyFiles(module, modules);
// 	}
	
// 	async applyInstanceFiles(modules: Module[], instanceUrl: string, connectedInstances: string[]) {
// 		if (!connectedInstances.includes(instanceUrl)) {
// 			window.showWarningMessage('Simplicite: ' + instanceUrl + ' is not connected');
// 			throw '';
// 		}
// 		for (const mod of modules) {
// 			if (mod.instanceUrl === instanceUrl && mod.connected) {
// 				await this.applyFiles(mod, modules);
// 			}
// 		}
// 	}
	
// 	async applyFiles (mod: Module, modules: Module[]) {
// 		let isJava = false;
// 		for (const file of this._fileHandler.fileList) {
// 			if (file.parentFolderName !== mod.name || !file.tracked) continue;
// 			const remoteContent = await this.isConflict(file, mod.name);
// 			// if a conflict occurs, dont send following files and start resolution
// 			if (remoteContent) {
// 				this.conflictStatus = true;
// 				await this.notifyAndSetConflict(file, remoteContent);
// 				return;
// 			}
// 			const res = await this._simpliciteApi.writeFile(file);
// 			if (!res) continue;
// 			// test if one java file is sent to trigger back compil
// 			if (file.extension === '.java') isJava = true;
// 			this._fileHandler.setTrackedStatus(file.uri, false, modules);
// 		}
// 		if (isJava) await this.triggerBackendCompilation(mod.instanceUrl);
// 	}
	
// 	// returns the content of the remote file if there is a conflict
// 	async isConflict(file: File, parentFolderName: string): Promise<Uint8Array | false> {  
// 		// first check if the local file has been modified -> compare working file with the temp file
// 		const workingFileContent = await File.getContent(file.uri);
// 		if (!workingFileContent) {
// 			throw new Error('Cannot get content from ' + file.uri.path);
// 		}
// 		const res = await this.hasLocalFileBeenModified(file, workingFileContent);
// 		if (!res) { // if local hasnt change, get the remote content 
// 			// fetch remote content and share state with working file and temp file
// 			const remoteContent = await this._simpliciteApi.getRemoteFileContent(file);
// 			if (!remoteContent) {
// 				throw new Error('Cannot get remote file content.');
// 			}
// 			await workspace.fs.writeFile(file.uri, remoteContent);
// 			await workspace.fs.writeFile(Uri.file(File.tempPathMaker(file)), remoteContent);
// 			logger.info('Simplicite: No local changes. Fetched remote content.');
// 			return false;
// 		}
// 		// if we get there then local file has been modified, check if remote has changed
// 		const res2 = await this.isInitialStateDifferentThanRemote(file, parentFolderName);
// 		if (!res2) { // if not different then no conflict 
// 			return false;
// 		}
// 		return res2;
// 	}
	
// 	async hasLocalFileBeenModified(file: File, workingFileContent: Uint8Array): Promise<boolean> {
// 		const path = File.tempPathMaker(file);
// 		const uri = Uri.file(path);
// 		const tempFileContent = await File.getContent(uri);
// 		if (!tempFileContent) {
// 			throw new Error('Cannot get temp file content.');
// 		}
// 		// compare the content
// 		const isModified = Buffer.compare(workingFileContent, tempFileContent);
// 		if (isModified === 0) { // unchanged
// 			return false;
// 		}
// 		return true;
// 	}
	
// 	async isInitialStateDifferentThanRemote(file: File, parentFolderName: string): Promise<Uint8Array | false> {
// 		const content = await this._simpliciteApi.getRemoteFileContent(file);
// 		if (!content) {
// 			throw new Error('No content returned for ' + file.uri.path);
// 		}
// 		const initialContent = await File.getContent(Uri.file(File.tempPathMaker(file)));
// 		const isModified = Buffer.compare(initialContent, content);
// 		if (isModified === 0) {// no changes
// 			return false;
// 		}
// 		await workspace.fs.writeFile(Uri.file(STORAGE_PATH + 'temp/' + parentFolderName + '/RemoteFileContent.java'), content);
// 		return content;
// 	}
	
// 	async writeFileController(file: File, module: Module): Promise<void> {
// 		const remoteContent = await this.isConflict(file, module.name);
// 		if (remoteContent) {
// 			this.conflictStatus = true;
// 			await this.notifyAndSetConflict(file, remoteContent);
// 		} else {
// 			await this._simpliciteApi.writeFile(file);
// 			await workspace.fs.writeFile(Uri.file(File.tempPathMaker(file)), await File.getContent(file.uri)); // set temp file with current content
// 			if (file.extension === '.java') await this.triggerBackendCompilation(module.instanceUrl);
// 		}
// 	}
	
// 	async notifyAndSetConflict(file: File, remoteContent: Uint8Array) {
// 		await commands.executeCommand('vscode.diff', Uri.file(file.uri.path), Uri.file(STORAGE_PATH + 'temp/' + file.parentFolderName + '/RemoteFileContent.java'));
// 		window.showWarningMessage('Simplicite: Conflict detected, you can either modify the left file on the diff editor and save to apply the changes or click the following button to choose which file to override.', 'Choose action').then(async (click) => {
// 			if (click === 'Choose action') {
// 				const choice = await window.showQuickPick([{ label: 'Override remote content' }, { label: 'Override local content' }]);
// 				// prevent the case where user already resolved conflict and still choose an action to resolve
// 				if (!this.conflictStatus) {
// 					window.showWarningMessage('Simplicite: there is no conflict to resolve');
// 				}else if (!choice) { 
// 					const msg = 'No file has been chosen';
// 					window.showInformationMessage('Simplicite: ' + msg);
// 					throw new Error(msg);
// 				} else if (choice.label === 'Override local content') { // write remote content on local
// 					await workspace.fs.writeFile(Uri.file(file.uri.path), remoteContent);
// 					await workspace.fs.writeFile(Uri.file(File.tempPathMaker(file)), remoteContent);
// 					await workspace.fs.delete(Uri.file(STORAGE_PATH + 'temp/' + file.parentFolderName + '/RemoteFileContent.java'));
// 					await this.resolveStatus(file);
// 				} else if (choice.label === 'Override remote content') { // write local content on remote
// 					await this._simpliciteApi.writeFile(file);
// 					await workspace.fs.writeFile(Uri.file(File.tempPathMaker(file)), await File.getContent(file.uri));
// 					await workspace.fs.delete(Uri.file(STORAGE_PATH + 'temp/' + file.parentFolderName + '/RemoteFileContent.java'));
// 					await this.resolveStatus(file);
// 				}
// 			}
// 		});
// 	}
	
// 	async resolveConflict(file: File): Promise<void> {
// 		await this._simpliciteApi.writeFile(file);
// 		await workspace.fs.writeFile(Uri.file(File.tempPathMaker(file)), await File.getContent(file.uri));
// 		await workspace.fs.delete(Uri.file(STORAGE_PATH + 'temp/' + file.parentFolderName + '/RemoteFileContent.java'));
// 		await this.resolveStatus(file);
// 	}
	
// 	private async resolveStatus (file: File) {
// 		this.conflictStatus = false;
// 		if (!workspace.getConfiguration('simplicite-vscode-tools').get('api.sendFileOnSave')) {
// 			await this._fileHandler.setTrackedStatus(file.uri, false, this._moduleHandler.modules);
// 		}
// 	}
	
// 	private async triggerBackendCompilation(instanceUrl: string): Promise<any> {
// 		try {
// 			this.backendCompiling = true;
// 			const app = this._appHandler.getApp(instanceUrl);
// 			const obj = app.getBusinessObject('Script', 'ide_Script');
// 			const res = await obj.action('CodeCompile', 0);
// 			const msg = `${instanceUrl} compilation result : ${res}`;
// 			window.showInformationMessage('Simplicite: ' + msg);
// 			logger.info(msg);
// 		} catch (e) {
// 			logger.error(e);
// 			window.showErrorMessage('Simplicite: Error cannnot trigger backend compilation');
// 		}
// 		this.backendCompiling = false;
// 	}
	
// 	private async localCompilation(fileList: Array<File>, moduleName: string | undefined): Promise<boolean> { // pass undefined as moduleName to check every module
// 		if (!workspace.getConfiguration('simplicite-vscode-tools').get('compilation')) {
// 			const res = await this.compileJava(
// 				{
// 					message: 'Cannot apply changes with compilation errors (you can disable the compilation step in the settings).',
// 					button: 'Settings'
// 				});
// 			if (res !== 'Compilation succeeded') {
// 				window.showWarningMessage('Simplicite: Local compilation failed');
// 				return false;
// 			}
// 		}
// 		return true;
// 	}
		
// 	bindFileWithModule(fileList: Array<File>): Map<string, Array<File>> {
// 		let flag = false;
// 		const fileModule: Map<string, Array<File>> = new Map();
// 		for (const file of fileList) {
// 			if (this._moduleHandler.connectedInstances.includes(file.simpliciteUrl)) {
// 				fileModule.get(file.simpliciteUrl) ? fileModule.get(file.simpliciteUrl)?.push(file) : fileModule.set(file.simpliciteUrl, [file]);
// 				flag = true;
// 			}
// 		}
// 		if (!flag) {
// 			throw new Error('Simplicite: Module not connected, check the connected instances');
// 		}
// 		return fileModule;
// 	}
		
// 	async compileJava(customMessage?: CustomMessage): Promise<string> {
// 		// status can have the following values FAILED = 0, SUCCEED = 1, WITHERROR = 2, CANCELLED = 3
// 		const redhatJava = extensions.getExtension('redhat.java');
// 		if (redhatJava === undefined) {
// 			const message = 'Cannot compile workspace, the redhat.java extension is not available, probably not installed or disabled';
// 			window.showWarningMessage('Simplicite: ' + message);
// 			throw new Error(message);
// 		}
// 		try {
// 			const status = await commands.executeCommand('java.workspace.compile', false);
// 			switch (status) {
// 			case 0:
// 				window.showErrorMessage('Simplicite: Compilation failed');
// 				return Promise.resolve('Compilation failed');
// 			case 1:
// 				return Promise.resolve('Compilation succeeded');
// 			case 3:
// 				window.showErrorMessage('Simplicite: Compilation cancelled');
// 				return Promise.resolve('Compilation cancelled');
// 			}
// 		} catch (e: any) {
// 			if (customMessage) { // occurs when compileJava is called from applyChangedHandler
// 				window.showErrorMessage('Simplicite: An error occured during the compilation. ' + customMessage.message, customMessage.button).then(click => {
// 					if (click === 'Settings') {
// 						openSettings();
// 					}
// 				});
// 				logger.error('Cannot Apply changers: an error occured during the compilation. Check if there is no error in the java files of your module(s)');
// 				throw new Error('');
// 			} else {
// 				window.showErrorMessage('Simplicite: An error occured during the compilation.');
// 				throw new Error((e.message ? e.message : e) + ' Check if there is error(s) in the java files of your module(s)');
// 			}
// 		}
// 		return Promise.resolve('');
// 	}
	
// 	setModuleInfoTree(moduleInfoTree: ModuleInfoTree): void {
// 		this._moduleInfoTree = moduleInfoTree;
// 	}
// }

// // open the VSCode settings view
// function openSettings() {
// 	try {
// 		commands.executeCommand('workbench.action.openSettings', '@ext:simpliciteSoftware.simplicite-vscode-tools');
// 	} catch (e) {
// 		logger.error(e);
// 	}
// }