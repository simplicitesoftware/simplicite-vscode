/* eslint-disable @typescript-eslint/no-non-null-assertion */
'use strict';

import { Module } from './Module';
import { window, commands, workspace, extensions, env, Uri } from 'vscode';
import { AppHandler } from './AppHandler';
import { ModuleHandler } from './ModuleHandler';
import { logger } from './Log';
import { File } from './File';
import { CustomMessage, Credentials } from './interfaces';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { ApiFileSystemController } from './ApiFileSystemController';
import { isHttpsUri, isHttpUri } from 'valid-url';
import { SimpliciteApi } from './SimpliciteApi';
import { FileHandler } from './FileHandler';
import { getFileExtension } from './utils';

export class SimpliciteApiController {
	
	private appHandler: AppHandler;
	moduleHandler: ModuleHandler;
	moduleInfoTree?: ModuleInfoTree;
	apiFileSystemController: ApiFileSystemController[];
	simpliciteApi: SimpliciteApi;
	_conflictStatus
	constructor(moduleHandler: ModuleHandler, simpliciteApi: SimpliciteApi,appHandler: AppHandler) {
		this.appHandler = appHandler;
		this.moduleHandler = moduleHandler;
		this.apiFileSystemController = [];
		this.simpliciteApi = simpliciteApi;
		this._conflictStatus = false;
	}

	async loginAll(): Promise<void> {
		for (const module of this.moduleHandler.modules) {
			if (module.connected) {
				continue;
			} else if (!isHttpsUri(module.instanceUrl) && !(isHttpUri(module.instanceUrl))) {
				window.showErrorMessage('Simplicite: ' + module.instanceUrl + ' is not a valid url');
				continue;
			}
			await this.tokenOrCredentials(module);
		}
	}

	async tokenOrCredentials(module: Module): Promise<void> {
		let credentials: Credentials | undefined;
		let token = '';
		if (module.token === '') {
			credentials = await this.getCredentials(module);
		} else {
			token = module.token;
		}
		await this.loginMethod(module, credentials, token);
	}

	private async loginMethod(module: Module, credentials: Credentials | undefined, token: string): Promise<void> {
		const instanceUrl = module.instanceUrl;
		const givenToken = await this.simpliciteApi.login(instanceUrl, credentials, token);
		if (!givenToken) {
			this.moduleHandler.spreadToken(instanceUrl, ''); // reset token
			this.moduleHandler.saveModules();
			return;
		}
		await this.moduleHandler.loginModuleState(this.simpliciteApi, module, givenToken);
		this.moduleInfoTree?.feedData(this.simpliciteApi.devInfo, this.moduleHandler.modules);
	} 

	private async getCredentials(module: Module): Promise<Credentials | undefined> {
		try {
			let usernamePlaceHolder = 'username';
			let passwordPlaceHolder = 'password';
			if (env.appHost !== 'desktop') {
				usernamePlaceHolder = `username (instance url: ${module.instanceUrl})`;
				passwordPlaceHolder = `password (instance url: ${module.instanceUrl})`;
			}
			const username = await window.showInputBox({
				placeHolder: usernamePlaceHolder,
				title: 'Simplicite: Authenticate to ' + module.name + ' API (' + module.instanceUrl + ')'
			});
			if (!username) {
				throw new Error('Authentication cancelled');
			}
			const password = await window.showInputBox({
				placeHolder: passwordPlaceHolder,
				title: 'Simplicite: Authenticate to ' + module.name + ' API (' + module.instanceUrl + ')',
				password: true
			});
			if (!password) {
				throw new Error('Authentication cancelled');
			}
			return { userName: username, password: password };
		} catch (e) {
			// if the process is cancelled, delete app
			this.appHandler.appList.delete(module.instanceUrl);
			return undefined;
		}
	}

	async logoutAll(): Promise<void> { // disconnect every instance
		this.appHandler.appList.forEach(async (app: any, key: string) => {
			await this.instanceLogout(key);
		});
	}

	async instanceLogout(instanceUrl: string): Promise<void> { // disconnect specific instance
		await this.simpliciteApi.logout(instanceUrl);
		this.moduleHandler.logoutModuleState(instanceUrl, this.moduleInfoTree!, this.simpliciteApi.devInfo);
		this.appHandler.appList.delete(instanceUrl);
	}

	async applyAll(fileHandler: FileHandler, modules: Module[]): Promise<void> { // Apply all files
		for (const mod of modules) {
			if (!mod.connected) continue;
			for (const file of fileHandler.fileList) {
				if (!file.tracked || file.parentFolderName === mod.parentFolderName) continue;
				await this.simpliciteApi.writeFile( file, mod);
				fileHandler.setTrackedStatus(file.uri, false, modules);
			}
		}
	}

	async applyModuleFiles(fileHandler: FileHandler, module: Module, modules: Module[]): Promise<void> { // Apply the changes of a specific module
		if (!module.connected) {
			window.showWarningMessage('Simplicite: ' + module.name + ' is not connected');
			return;
		}
		for (const file of fileHandler.fileList) {
			if (file.parentFolderName !== module.parentFolderName || !file.tracked) continue;
			const res = await this.simpliciteApi.writeFile(file, module);
			if (!res) continue;
			fileHandler.setTrackedStatus(file.uri, false, modules);
		}
	}

	/*async applyInstanceFiles() { // Apply the changes of a specific instance
		const fileModule = this.bindFileWithModule(this.fileHandler.fileList);
		let success = 0;
		for (const instanceUrl of this.moduleHandler.connectedInstances) {
			const app = this.appHandler.getApp(instanceUrl);
			if (!fileModule.get(instanceUrl)) {
				continue;
			}
			for (const file of fileModule.get(instanceUrl)!) {
				if (file.tracked) {
					success = await this.sendFileMessageWrapper(file, app);
				}
			}
			if (success > 0) {
				try {
					await this.triggerBackendCompilation(app);
					logger.info('Backend compilation succeeded');
				} catch (e: any) {
					window.showErrorMessage(e.message);
					logger.error(e.message);
				}
			}
		}
	}*/

	async synchronizeFileApiController (file: File, module: Module): Promise<void> {
		if (!module.connected) {
			window.showErrorMessage('Simplicite: ' + module.name + ' is not connected.');
			return; 
		}
		//await this.conflictChecker(file);
		const fileExtension = getFileExtension(file.uri.path);
		await this.simpliciteApi.writeFile(file, module);
		if (module.apiFileSystem) {
			//await workspace.fs.writeFile(Uri.parse(STORAGE_PATH + file.parentFolderName + '/.temp/' + file.name + fileExtension), workingFileContent);
			const uri = Uri.parse(STORAGE_PATH + file.parentFolderName + '/.temp/RemoteFile.java');
			try {
				await workspace.fs.delete(uri);
			} catch (e) {
				logger.error(STORAGE_PATH + file.parentFolderName + '/.temp/RemoteFile.java' + ' does not exist (no conflict)');
			}
			this._conflictStatus = false;
		}
	}

	async conflictChecker (file: File): Promise<void> {
		const initialStateUri = Uri.parse(STORAGE_PATH + file.parentFolderName + '/.temp/' + file.name + file.extension);
		const init =  await workspace.fs.readFile(initialStateUri); 
		const remoteFileContent = Buffer.from(item[fieldScriptId].content, 'base64');
		// check if the local initial state of the file is the same as the remote file
		const isRemoteEqualToInitial = Buffer.compare(remoteFileContent, localInitialFileContent);
		const isWorkingEqualToInitial = Buffer.compare(workingFileContent, localInitialFileContent);
		if (isRemoteEqualToInitial !== 0 && isWorkingEqualToInitial !== 0) {
			const remoteFilePath = Uri.parse(STORAGE_PATH + file.parentFolderName + '/.temp/RemoteFile.java');
			this._conflictStatus = true;
			// need to write the file in order to get the file content in vscode.diff
			await workspace.fs.writeFile(remoteFilePath, Buffer.from(item[fieldScriptId].content, 'base64'));
			await commands.executeCommand('vscode.diff', Uri.parse(file.path), remoteFilePath);
			window.showWarningMessage('Simplicite: Conflict detected with remote file, edit the file on the left panel and save to apply the modifications. If you do not want to merge the two versions, you can overwrite the content of the file of your choice by clicking on the following button and choose between these two actions: \'Remote\' to overwrite the local content with the remote content & \'Local\' to overwrite the remote content with the local content. Note that the modifications on the overwritten file will be lost', 'Choose action').then(async (click) => {
				if (click === 'Choose action') {
					const choice = await window.showQuickPick([{ label: 'Remote' }, { label: 'Local' }]);
					if (!choice) {
						const msg = 'No file has been chosen';
						window.showInformationMessage('Simplicite: ' + msg);
						throw new Error(msg);
					} else if (choice.label === 'Remote') { // just write content on local file
						await workspace.fs.writeFile(Uri.parse(file.path), Buffer.from(item[fieldScriptId].content, 'base64'));
						await workspace.fs.writeFile(initialFilePath, item[fieldScriptId].content);
						await workspace.fs.delete(remoteFilePath);
						this._conflictStatus = false;
					} else if (choice.label === 'Local') {
						// to do
						//await this.writeFile(file, devInfo, module);
					}
				}
			});
			throw new Error('Conflict');
		} else if (isWorkingEqualToInitial === 0 && isRemoteEqualToInitial !== 0) {
			// if no local changes and remote changed, update local files
			await workspace.fs.writeFile(Uri.parse(file.path), Buffer.from(item[fieldScriptId].content, 'base64'));
			await workspace.fs.writeFile(initialFilePath, Buffer.from(item[fieldScriptId].content, 'base64'));
			window.showInformationMessage('Simplicite: Local file content hasn\'t changed. Fetched latest remote file content');
			throw new Error('No local changes on save, remote file was changed --> fetched file content to local');
		} else if (isRemoteEqualToInitial === 0 && isWorkingEqualToInitial === 0) {
			throw new Error('No changes');
		}
	}

	private async triggerBackendCompilation(app: any) {
		try {
			const obj = app.getBusinessObject('Script', 'ide_Script');
			const res = await obj.action('CodeCompile', 0);
			window.showInformationMessage(`Simplicite: ${res}`); // differentiate error and info
			logger.info('compilation succeeded');
		} catch (e) {
			logger.error(e);
			window.showErrorMessage('Simplicite: Error cannnot trigger backend compilation');
		}
	}

	private async localCompilation(fileList: Array<File>, moduleName: string | undefined): Promise<boolean> { // pass undefined as moduleName to check every module
		if (!workspace.getConfiguration('simplicite-vscode-tools').get('compilation.enabled')) {
			const res = await this.compileJava(
				{
					message: 'Cannot apply changes with compilation errors (you can disable the compilation step in the settings).',
					button: 'Settings'
				});
			if (res !== 'Compilation succeeded') {
				window.showWarningMessage('Simplicite: Local compilation failed');
				return false;
			}
		}
		return true;
	}

	bindFileWithModule(fileList: Array<File>): Map<string, Array<File>> {
		let flag = false;
		const fileModule: Map<string, Array<File>> = new Map();
		for (const file of fileList) {
			if (this.moduleHandler.connectedInstances.includes(file.simpliciteUrl)) {
				fileModule.get(file.simpliciteUrl) ? fileModule.get(file.simpliciteUrl)?.push(file) : fileModule.set(file.simpliciteUrl, [file]);
				flag = true;
			}
		}
		if (!flag) {
			throw new Error('Simplicite: Module not connected, check the connected instances');
		}
		return fileModule;
	}

	async compileJava(customMessage?: CustomMessage): Promise<string> {
		// status can have the following values FAILED = 0, SUCCEED = 1, WITHERROR = 2, CANCELLED = 3
		const redhatJava = extensions.getExtension('redhat.java');
		if (redhatJava === undefined) {
			const message = 'Cannot compile workspace, the redhat.java extension is not available, probably not installed or disabled';
			window.showWarningMessage('Simplicite: ' + message);
			throw new Error(message);
		}
		try {
			const status = await commands.executeCommand('java.workspace.compile', false);
			switch (status) {
			case 0:
				window.showErrorMessage('Simplicite: Compilation failed');
				return Promise.resolve('Compilation failed');
			case 1:
				return Promise.resolve('Compilation succeeded');
			case 3:
				window.showErrorMessage('Simplicite: Compilation cancelled');
				return Promise.resolve('Compilation cancelled');
			}
		} catch (e: any) {
			if (customMessage) { // occurs when compileJava is called from applyChangedHandler
				window.showErrorMessage('Simplicite: An error occured during the compilation. ' + customMessage.message, customMessage.button).then(click => {
					if (click === 'Settings') {
						openSettings();
					}
				});
				logger.error('Cannot Apply changers: an error occured during the compilation. Check if there is no error in the java files of your module(s)');
				throw new Error('');
			} else {
				window.showErrorMessage('Simplicite: An error occured during the compilation.');
				throw new Error((e.message ? e.message : e) + ' Check if there is error(s) in the java files of your module(s)');
			}
		}
		return Promise.resolve('');
	}
}

function openSettings() {
	try {
		commands.executeCommand('workbench.action.openSettings', '@ext:simpliciteSoftware.simplicite-vscode-tools');
	} catch (e) {
		logger.error(e);
	}
}