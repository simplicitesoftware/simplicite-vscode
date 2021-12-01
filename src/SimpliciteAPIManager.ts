'use strict';

import { Module } from './Module';
import { window, commands, workspace, extensions, env, Uri } from 'vscode';
import { Cache } from './Cache';
import { FileHandler } from './FileHandler';
import { AppHandler } from './AppHandler';
import { ModuleHandler } from './ModuleHandler';
import { logger } from './Log';
import { File } from './File';
import { removeFileExtension, replaceAll } from './utils';
import { BarItem } from './BarItem';
import { ReturnValueOperationsBeforeObjectManipulation, CustomMessage } from './interfaces';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { RFSControl } from './rfs/RFSControl';
import { Buffer } from 'buffer';
import { isHttpsUri } from 'valid-url';

export class SimpliciteAPIManager {
	cache: Cache;
	devInfo: any;
	appHandler: AppHandler;
	fileHandler: FileHandler;
	moduleHandler: ModuleHandler;
	barItem?: BarItem;
	moduleInfoTree?: ModuleInfoTree;
	RFSControl: RFSControl[];
	conflictStatus: boolean;
	constructor(fileHandler: FileHandler, moduleHandler: ModuleHandler) {
		this.cache = new Cache();
		this.devInfo = undefined; // needs to be logged in, fetch on first login (provides services only when connected)
		this.appHandler = new AppHandler();
		this.fileHandler = fileHandler;
		this.moduleHandler = moduleHandler;
		this.conflictStatus = false;
		this.RFSControl = [];
	}

	async loginHandler(): Promise<void> {
		if (this.moduleHandler.moduleLength() > 0) {
			for (const module of this.moduleHandler.modules) {
				if (!this.moduleHandler.connectedInstancesUrl.includes(module.instanceUrl)) {
					try {
						await this.loginTokenOrCredentials(module);
					} catch (e: any) {
						window.showErrorMessage(e.message ? e.message : e);
						logger.error(`Module ${module.name}: ${e.message ? e.message : e}`);
					}
				}
			}
		} else {
			window.showInformationMessage('Simplicite: No Simplicite module has been found');
		}
	}

	async loginTokenOrCredentials(module: Module): Promise<void> {
		try {
			if (!isHttpsUri(module.instanceUrl)) {
				throw new Error('Simplicite: ' + module.instanceUrl + ' is not a valid url');
			}
			const app = this.appHandler.getApp(module.instanceUrl); // handleApp returns the app correct instance (one for every simplicite instance)
			if (module.token === '') {
				await this.authenticationWithCredentials(module.name, app);
				await this.loginMethod(module, app);
			} else {
				app.authtoken = module.token;
				await this.loginMethod(module, app);
			}
			await this.refreshModuleDevInfo();
			this.moduleHandler.setSavedData();
			this.moduleHandler.saveModules();
		} catch(e: any) {
			for (const mod of this.moduleHandler.modules) {
				if (mod.workspaceFolderPath === module.workspaceFolderPath) {
					mod.remoteFileSystem = false;
				}
			}
			this.moduleHandler.deleteModule(module.instanceUrl, undefined);
			window.showErrorMessage(e);
		}

	}

	private async loginMethod(module: Module, app: any): Promise<void> {
		try {
			const res = await app.login();
			if (!this.devInfo) {
				await this.setDevInfo(app);
			}
			this.moduleHandler.spreadToken(module.instanceUrl, res.authtoken);
			this.appHandler.setApp(module.instanceUrl, app);
			this.moduleHandler.addInstanceUrl(module.instanceUrl);
			if (module.remoteFileSystem && this.devInfo) {
				const rfsControl = new RFSControl(app, module, this.devInfo);
				this.RFSControl.push(rfsControl);
				await rfsControl.initAll(this.moduleHandler);
			}
			window.showInformationMessage('Simplicite: Logged in as ' + res.login + ' at: ' + app.parameters.url);
			logger.info('Logged in as ' + res.login + ' at: ' + app.parameters.url);
			if (this.barItem) this.barItem.show(this.moduleHandler.modules, this.moduleHandler.connectedInstancesUrl);
		} catch (e: any) {
			module.remoteFileSystem = false;
			this.moduleHandler.deleteModule(undefined, module.workspaceFolderPath);
			this.appHandler.appList.delete(module.instanceUrl);
			this.moduleHandler.spreadToken(module.instanceUrl, '');
			let msg = e.message;
			if (e.message === 'Failed to fetch') {
				msg = app.parameters.url + ' is not responding';
			} else if (e.message === 'Cannot read field "m_lang" because "this.m_data" is null') {
				this.moduleHandler.modules = [];
				this.moduleHandler.saveModules();
			}
			window.showErrorMessage('Simplicite: ' + msg);
			logger.error(e);
		}
	} 

	private async authenticationWithCredentials(moduleName: string, app: any) {
		try {
			let usernamePlaceHolder = 'username';
			let passwordPlaceHolder = 'password';
			if (env.appHost !== 'desktop') {
				usernamePlaceHolder = `username (instance url: ${app.parameters.url})`;
				passwordPlaceHolder = `password (instance url: ${app.parameters.url})`;
			}
			const username = await window.showInputBox({
				placeHolder: usernamePlaceHolder,
				title: 'Simplicite: Authenticate to ' + moduleName + ' API (' + app.parameters.url + ')'
			});
			if (!username) {
				throw new Error('Authentication cancelled');
			}
			const password = await window.showInputBox({
				placeHolder: passwordPlaceHolder,
				title: 'Simplicite: Authenticate to ' + moduleName + ' API (' + app.parameters.url + ')',
				password: true
			});
			if (!password) {
				throw new Error('Authentication cancelled');
			}
			app.setPassword(password);
			app.setUsername(username);
		} catch (e) {
			this.appHandler.appList.delete(app.parameters.url);
			throw new Error('Check instance Url');
		}
	}

	async logout(): Promise<void> {
		this.fileHandler.deleteSimpliciteInfo();
		this.appHandler.appList.forEach(async (app: any) => {
			app.logout().then((res: any) => {
				this.moduleHandler.deleteModule(app.parameters.url, undefined);
				this.appHandler.appList.delete(app.parameters.url);
				this.moduleHandler.spreadToken(app.parameters.url, '');
				this.moduleHandler.removeConnectedInstancesUrl(app.parameters.url);
				window.showInformationMessage('Simplicite: ' + res.result + ' from: ' + app.parameters.url);
				logger.info(res.result + ' from: ' + app.parameters.url);
				if (this.barItem) this.barItem.show(this.moduleHandler.modules, this.moduleHandler.connectedInstancesUrl);
			}).catch((e: any) => {
				logger.error(e);
				window.showErrorMessage(e.message ? e.message : e);
			});
		});
		if (this.appHandler.appList.size === 0) {
			window.showErrorMessage('Simplicite: You are not connected to any module');
		}
	}

	async specificLogout(instanceUrl: string): Promise<void> {
		try {
			const app = this.appHandler.getApp(instanceUrl);
			app.logout().then(async (res: any) => {
				this.moduleHandler.deleteModule(instanceUrl, undefined);
				this.appHandler.appList.delete(instanceUrl);
				this.moduleHandler.spreadToken(instanceUrl, '');
				this.moduleHandler.removeConnectedInstancesUrl(instanceUrl);
				window.showInformationMessage('Simplicite: ' + res.result + ' from: ' + app.parameters.url);
				logger.info(res.result + ' from: ' + app.parameters.url);
				if (this.barItem) this.barItem.show(this.moduleHandler.modules, this.moduleHandler.connectedInstancesUrl);
			}).catch((e: any) => {
				if (e.status === 401 || e.code === 'ECONNREFUSED') {
					window.showInformationMessage(`Simplicite: You are not connected to ${instanceUrl}`);
				} else {
					logger.error(e);
					window.showErrorMessage(`${e}`);
				}
			});
		} catch (e: any) {
			logger.error(e);
			window.showInformationMessage(e.message ? e.message : e);
		}
	}

	async applyChangesHandler(moduleName: string | undefined, instanceUrl: string | undefined): Promise<void> {
		if (moduleName && instanceUrl) {
			if (!checkFileModuleSpecific(moduleName, this.fileHandler.fileList)) {
				throw new Error('Simplicite: No file has changed, cannot apply changes');
			}
			await this.beforeApply(this.fileHandler.fileList, moduleName, async () => {
				await this.applyModuleFiles(moduleName, instanceUrl);
			});


		} else {
			await this.beforeApply(this.fileHandler.fileList, undefined, async () => {
				await this.applyInstanceFiles();
			});
		}
		return;
	}

	private async applyModuleFiles(moduleName: string, instanceUrl: string) {
		const app = this.appHandler.getApp(instanceUrl);
		let success = 0;
		for (const file of this.fileHandler.fileList) {
			if (file.moduleName === moduleName && file.tracked) {
				success = await this.sendFileMessageWrapper(file, app);
			}
		}
		if (success > 0) {
			try {
				const res: any = await this.triggerBackendCompilation(app);
				window.showInformationMessage(res);
			} catch (e: any) {
				window.showInformationMessage(e.message);
			}
		}
	}

	private async applyInstanceFiles() {
		const fileModule = this.bindFileWithModule(this.fileHandler.fileList);
		let success = 0;
		for (const instanceUrl of this.moduleHandler.connectedInstancesUrl) {
			const app = this.appHandler.getApp(instanceUrl);
			if (fileModule.get(instanceUrl)) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				for (const file of fileModule.get(instanceUrl)!) {
					if (file.tracked) {
						success = await this.sendFileMessageWrapper(file, app);
					}
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
	}

	private async sendFileMessageWrapper(file: File, app: any): Promise<number> { // easy way to handle messages when an error occurs when applying a file
		let success = 0;
		try {
			const res = await this.sendFile(file, app);
			if (res) {
				success++;
			}
			await this.fileHandler.setTrackedStatus(file.filePath, false, this.fileHandler.bindFileAndModule(this.moduleHandler.modules, this.fileHandler.fileList));
		} catch (e) {
			logger.error('Cannot apply ' + file.filePath);
		}
		return Promise.resolve(success);
	}

	private async sendFile(file: File, app: any): Promise<boolean> {
		try {
			await this.attachFileAndSend(file, app);
			logger.info('Successfully applied' + file.filePath);
			return Promise.resolve(true);
		} catch (e: any) {
			window.showErrorMessage(`Simplicite: Error sending ${file.filePath}. ${e.message ? e.message : e}.`);
			logger.error(e);
			return Promise.reject(false);
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

	private async beforeApply(fileList: Array<File>, moduleName: string | undefined, callback: () => Promise<void>): Promise<void> {
		if (this.moduleHandler.connectedInstancesUrl.length === 0) {
			throw new Error('Simplicite: No module connected, cannot apply changes');
		} else if (moduleName) { // module apply
			let isTracked = false;
			for (const file of fileList) {
				if (file.tracked && file.moduleName === moduleName) {
					isTracked = true;
				}
			}
			if (!isTracked) {
				throw new Error('Simplicite: No file has changed, cannot apply changes');
			}
		} else if (moduleName === undefined) { // apply
			let isTracked = false;
			for (const file of fileList) {
				if (file.tracked && file.moduleName) {
					isTracked = true;
				}
			}
			if (!isTracked) {
				throw new Error('Simplicite: No file has changed, cannot apply changes');
			}
		}
		// check if extension is available
		if (!workspace.getConfiguration('simplicite-vscode-tools').get('compilation.enabled')) {
			const res = await this.compileJava(
				{
					message: 'Cannot apply changes with compilation errors (you can disable the compilation step in the settings).',
					button: 'Settings'
				});
			if (res !== 'Compilation succeeded') {
				throw new Error('Local compilation failed');
			}
		}
		await callback();
	}

	bindFileWithModule(fileList: Array<File>): Map<string, Array<File>> {
		let flag = false;
		const fileModule: Map<string, Array<File>> = new Map();
		for (const file of fileList) {
			if (this.moduleHandler.connectedInstancesUrl.includes(file.instanceUrl)) {
				fileModule.get(file.instanceUrl) ? fileModule.get(file.instanceUrl)?.push(file) : fileModule.set(file.instanceUrl, [file]);
				flag = true;
			}
		}
		if (!flag) {
			throw new Error('Simplicite: Module not connected, check the connected instances');
		}
		return fileModule;
	}

	// Called by synchronize
	async attachFileAndSend(file: File, app: any) {
		// get fileType and Filename
		let fileType: string;
		let fileName: string;
		let properNameField: string;
		let fileExtension: string;
		// eslint-disable-next-line prefer-const
		({ fileType, fileName, properNameField, fileExtension } = this.operationsBeforeObjectManipulation(file.filePath));
		// get the item for the update
		const obj = await app.getBusinessObject(fileType, 'ide_' + fileType);
		const item = await this.searchForUpdate(fileName, obj, properNameField, fileType, file.filePath);
		const fieldScriptId = this.getProperScriptField(fileType);
		const workingFileContent = await workspace.fs.readFile(Uri.parse(file.filePath));
		const module = this.moduleHandler.getModuleFromWorkspacePath(file.workspaceFolderPath);
		if (module !== false && module.remoteFileSystem) {
			await this.conflictChecker(workingFileContent, file, fileName, fileExtension, item, fieldScriptId);
		}
		// give the field, ex: obo_script_id, scr_file
		
		const doc = obj.getFieldDocument(fieldScriptId);
		if (doc === undefined) {
			throw new Error('No document returned, cannot update content');
		}
		// get the file content for setContent

		const fileContent = await workspace.findFiles('**/src/**/' + fileName + fileExtension);
		workspace.openTextDocument(fileContent[0]).then((document) => {
			const text = document.getText();
			doc.setContentFromText(text);
			obj.setFieldValue(fieldScriptId, doc);
			obj.update(item, { inlineDocuments: true }).then(async () => {
				// once the object is updated, write the content in the temp files so all the files share the same state (workingFileContent, localInitialFileContent & remoteFileContent) 
				await workspace.fs.writeFile(Uri.parse('Api_' + file.moduleName + '/temp/' + fileName + fileExtension), workingFileContent);
				await workspace.fs.delete(Uri.parse('Api_' + file.moduleName + '/RemoteFile.java'));
				this.conflictStatus = false;
				Promise.resolve();
			}).catch((e: Error) => {
				logger.error(e);
				throw e;
			});
		});
	}

	async conflictChecker (workingFileContent: Uint8Array, file: File, fileName: string, fileExtension: string, item: any, fieldScriptId: string): Promise<void> {
		try {
			if (this.conflictStatus) {
				return;
			}
			const initialFilePath = Uri.parse('Api_' + file.moduleName + '/temp/' + fileName + fileExtension);
			const localInitialFileContent =  await workspace.fs.readFile(initialFilePath); 
			const remoteFileContent = Buffer.from(item[fieldScriptId].content, 'base64');
			// check if the local initial state of the file is the same as the remote file
			const isRemoteEqualToInitial = Buffer.compare(remoteFileContent, localInitialFileContent);
			const isWorkingEqualToInitial = Buffer.compare(workingFileContent, localInitialFileContent);
			if (isRemoteEqualToInitial !== 0 && isWorkingEqualToInitial !== 0) {
				const remoteFilePath = Uri.parse('Api_' + file.moduleName + '/RemoteFile.java');
				this.conflictStatus = true;
				// need to write the file in order to get the file content in vscode.diff
				await workspace.fs.writeFile(remoteFilePath, Buffer.from(item[fieldScriptId].content, 'base64'));
				await commands.executeCommand('vscode.diff', Uri.parse(file.filePath), remoteFilePath);
				window.showWarningMessage('Simplicite: Conflict detected with remote file, edit the file on the left panel and save to apply the modifications. If you do not want to merge the two versions, you can overwrite the content of the file of your choice by clicking on the following button and choose between these two actions: \'Remote\' to overwrite the local content with the remote content & \'Local\' to overwrite the remote content with the local content. Note that the modifications on the overwritten file will be lost', 'Choose action').then(async (click) => {
					if (click === 'Choose action') {
						const choice = await window.showQuickPick([{ label: 'Remote' }, { label: 'Local' }]);
						if (!choice) {
							const msg = 'No file has been chosen';
							window.showInformationMessage('Simplicite: ' + msg);
							throw new Error(msg);
						} else if (choice.label === 'Remote') { // just write content on local file
							await workspace.fs.writeFile(Uri.parse(file.filePath), Buffer.from(item[fieldScriptId].content, 'base64'));
							await workspace.fs.writeFile(initialFilePath, item[fieldScriptId].content);
							await workspace.fs.delete(remoteFilePath);
							this.conflictStatus = false;
						} else if (choice.label === 'Local') {
							await this.sendFile(file, this.appHandler.getApp(file.instanceUrl));
						}
					}
				});
				throw new Error('Conflict');
			} else if (isWorkingEqualToInitial === 0 && isRemoteEqualToInitial !== 0) {
				// if no local changes and remote changed, update local files
				await workspace.fs.writeFile(Uri.parse(file.filePath), Buffer.from(item[fieldScriptId].content, 'base64'));
				await workspace.fs.writeFile(initialFilePath, Buffer.from(item[fieldScriptId].content, 'base64'));
				window.showInformationMessage('Simplicite: Local file content hasn\'t changed. Fetched latest remote file content');
				throw new Error('No local changes on save, remote file was changed --> fetched file content to local');
			} else if (isRemoteEqualToInitial === 0 && isWorkingEqualToInitial === 0) {
				throw new Error('No changes');
			}
			//workspace.fs.delete(Uri.parse('Api_' + file.moduleName + '/RemoteFile.java'));
		} catch (e: any) {
			throw new Error(e);
		}
	}
	

	private operationsBeforeObjectManipulation(filePath: string): ReturnValueOperationsBeforeObjectManipulation {
		const fileType = this.getBusinessObjectType(filePath);
		const filePathDecomposed = filePath.split('/');
		const lastOfPath = filePathDecomposed[filePathDecomposed.length - 1];
		const fileExtensionTab = lastOfPath.split('.');
		const fileExtension = '.' + fileExtensionTab[fileExtensionTab.length - 1];
		const fileName = removeFileExtension(lastOfPath);
		const properNameField = this.getProperNameField(fileType);
		return { fileType, fileName, properNameField, fileExtension };
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	async searchForUpdate(fileName: string, obj: any, properNameField: string, fileType: string, filePath: string): Promise<any> {
		if (!this.cache.isInCache(fileName)) {
			const list = await obj.search({ [properNameField]: fileName });
			if (list.length === 0) {
				throw new Error('No object has been returned');
			}
			let objectFound = list[0];
			if (fileType === 'Resource') {
				for (const object of list) {
					if (object.res_object.userkeylabel === getResourceFileName(filePath)) {
						objectFound = object;
					}
				}
			}
			this.cache.addPair(fileName, objectFound.row_id);
		}
		const rowId = this.cache.getListFromCache(fileName);
		const item = await obj.getForUpdate(rowId, { inlineDocuments: true });
		return item;
	}

	private getProperScriptField(fileType: string) {
		if (!this.devInfo) {
			return;
		}
		for (const object of this.devInfo.objects) {
			if (fileType === object.object) {
				return object.sourcefield;
			}
		}
	}

	private getProperNameField(fileType: string) {
		if (!this.devInfo) {
			return;
		}
		for (const object of this.devInfo.objects) {
			if (fileType === object.object) {
				return object.keyfield;
			}
		}
	}

	// Change path into Java package modele to find object type with dev info
	private getBusinessObjectType(filePath: string): string {
		if (!this.devInfo) {
			throw new Error('devInfo is undefined, make sure that you have the right to access this module');
		}
		for (const object of this.devInfo.objects) {
			if (object.package) {
				const comparePackage = replaceAll(object.package, /\./, '/');
				if (filePath.includes(comparePackage)) {
					return object.object;
				}
			}
		}
		if (filePath.includes('/resources/')) { // programatically handling packages that are not in devInfo
			return 'Resource';
		} else if (filePath.includes('/test/src/com/simplicite/')) {
			return 'Script';
		} else if (filePath.includes('/scripts/')) {
			return 'Disposition';
		} else {
			throw new Error('No type has been found');
		}
	}

	private async setDevInfo(app: any): Promise<void> {
		try {
			this.devInfo = await app.getDevInfo();
			if (this.moduleInfoTree) this.moduleInfoTree.setDevInfo(this.devInfo);
		} catch(e: any) {
			logger.error('unable to fetch devInfo');
		}
	}

	private async moduleDevInfo (app: any, module: Module): Promise<any> {
		try {
			return await app.getDevInfo(module.name);
		} catch (e: any) {
			logger.error('unable to fetch module dev info');
			return false;
		}
	}

	async refreshModuleDevInfo(): Promise<void> { // changes directly module's attribute moduleDevInfo 
		try {
			for (const module of this.moduleHandler.modules) {
				if (this.moduleHandler.connectedInstancesUrl.includes(module.instanceUrl)) {
					const app = this.appHandler.getApp(module.instanceUrl);
					module.moduleDevInfo = await this.moduleDevInfo(app, module);
				}
			}
			if (this.moduleInfoTree) {
				this.moduleInfoTree.setModules(this.moduleHandler.modules);
			}
		} catch (e) {
			logger.error(e);
		}
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

function getResourceFileName(filePath: string): string {
	const decomposed = filePath.split('/');
	return decomposed[decomposed.length - 2];
}

function openSettings() {
	try {
		commands.executeCommand('workbench.action.openSettings', '@ext:simpliciteSoftware.simplicite-vscode-tools');
	} catch (e) {
		logger.error(e);
	}
}

function checkFileModuleSpecific(moduleName: string, files: File[]) {
	for (const file of files) {
		if (file.moduleName === moduleName) {
			return true;
		}
	}
	return false;
}