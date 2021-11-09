'use strict';

import { Module } from './Module';
import { window, commands, workspace, extensions, env } from 'vscode';
import { Cache } from './Cache';
import { FileHandler } from './FileHandler';
import { crossPlatformPath } from './utils';
import { AppHandler } from './AppHandler';
import { ModuleHandler } from './ModuleHandler';
import { logger } from './Log';
import { File } from './File';
import { removeFileExtension, replaceAll } from './utils';
import { BarItem } from './BarItem';
import { ReturnValueOperationsBeforeObjectManipulation, CustomMessage } from './interfaces';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';

export class SimpliciteAPIManager {
	cache: Cache;
	devInfo: any;
	appHandler: AppHandler;
	fileHandler: FileHandler;
	moduleHandler: ModuleHandler;
	barItem: BarItem;
	moduleTreeView?: ModuleInfoTree;
	constructor(fileHandler: FileHandler, moduleHandler: ModuleHandler, barItem: BarItem) {
		this.cache = new Cache();
		this.devInfo = null; // needs to be logged in, fetch on first login (provides services only when connected)
		this.appHandler = new AppHandler();
		this.fileHandler = fileHandler;
		this.moduleHandler = moduleHandler;
		this.barItem = barItem;
	}

	static build(fileHandler: FileHandler, moduleHandler: ModuleHandler, barItem: BarItem): SimpliciteAPIManager {
		const simpliciteAPIManager = new SimpliciteAPIManager(fileHandler, moduleHandler, barItem);
		if (simpliciteAPIManager.moduleHandler.moduleLength() !== 0 && simpliciteAPIManager.fileHandler.fileListLength() !== 0) {
			logger.info('Modules and files set on initialization');
		}
		if (simpliciteAPIManager.moduleHandler.moduleLength() === 0) {
			logger.warn('No modules set on initialization');
		}
		if (simpliciteAPIManager.fileHandler.fileListLength() === 0) {
			logger.warn('No files set on initialization');
		}
		return simpliciteAPIManager;
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
		await this.refreshModuleDevInfo();
	}

	async loginTokenOrCredentials(module: Module): Promise<void> {
		const app = await this.appHandler.getApp(module.instanceUrl); // handleApp returns the app correct instance (one for every simplicite instance)
		if (module.token === '') {
			await this.authenticationWithCredentials(module.name, app, async () => {
				await this.loginMethod(module, app);
			});
		} else {
			app.authtoken = module.token;
			await this.loginMethod(module, app);
		}
	}

	private async loginMethod(module: Module, app: any): Promise<void> {
		try {
			const res = await app.login();
			if (!this.devInfo) {
				await this.setDevInfo(app);
			}
			await this.fileHandler.simpliciteInfoGenerator(res.authtoken, app.parameters.url); // if logged in we write a JSON with connected modules objects;
			this.moduleHandler.spreadToken(module.instanceUrl, res.authtoken);
			this.appHandler.setApp(module.instanceUrl, app);
			this.moduleHandler.addInstanceUrl(module.instanceUrl);
			window.showInformationMessage('Simplicite: Logged in as ' + res.login + ' at: ' + app.parameters.url);
			logger.info('Logged in as ' + res.login + ' at: ' + app.parameters.url);
			this.barItem.show(this.moduleHandler.modules, this.moduleHandler.connectedInstancesUrl);
		} catch (e: any) {
			if (e.status === 401) { 
				this.fileHandler.deleteModule(undefined, module.name);
				this.appHandler.appList.delete(module.instanceUrl);
				this.moduleHandler.spreadToken(module.instanceUrl, '');
			} else {
				app.setAuthToken(null);
				app.setPassword(null);
				app.setUsername(null);	
				await this.specificLogout(module);
			}
			window.showErrorMessage('Simplicite: ' + e.message);
			logger.error(e);
		}
	}

	private async authenticationWithCredentials(moduleName: string, app: any, callback: () => Promise<void>) {
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
		await callback();
	}

	async logout(): Promise<void> {
		this.fileHandler.deleteSimpliciteInfo();
		this.appHandler.appList.forEach(async (app: any) => {
			app.logout().then((res: any) => {
				this.appHandler.appList.delete(app.parameters.url);
				this.moduleHandler.spreadToken(app.parameters.url, '');
				window.showInformationMessage('Simplicite: ' + res.result + ' from: ' + app.parameters.url);
				logger.info(res.result + ' from: ' + app.parameters.url);
				this.moduleHandler.removeInstanceUrl(app.parameters.url);
				this.barItem.show(this.moduleHandler.modules, this.moduleHandler.connectedInstancesUrl);
			}).catch((e: any) => {
				logger.error(e);
				window.showErrorMessage(e.message ? e.message : e);
			});
		});
		if (this.appHandler.appList.size === 0) {
			window.showErrorMessage('Simplicite: You are not connected to any module');
		}
	}

	async specificLogout(module: Module): Promise<void> {
		try {
			const app = await this.appHandler.getApp(module.instanceUrl);
			app.logout().then(async (res: any) => {
				this.fileHandler.deleteModule(module.instanceUrl, undefined);
				this.appHandler.appList.delete(module.instanceUrl);
				this.moduleHandler.spreadToken(module.instanceUrl, '');
				this.moduleHandler.removeConnectedInstancesUrl(module.instanceUrl);
				window.showInformationMessage('Simplicite: ' + res.result + ' from: ' + app.parameters.url);
				logger.info(res.result + ' from: ' + app.parameters.url);
				this.barItem.show(this.moduleHandler.modules, this.moduleHandler.connectedInstancesUrl);
			}).catch((e: any) => {
				if (e.status === 401 || e.code === 'ECONNREFUSED') {
					window.showInformationMessage(`Simplicite: You are not connected to ${module.instanceUrl}`);
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
		const app = await this.appHandler.getApp(instanceUrl);
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
			const app = await this.appHandler.getApp(instanceUrl);
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
			await this.fileHandler.setTrackedStatus(file.filePath, false, this.fileHandler.bindFileAndModule(this.moduleHandler.modules));
		} catch (e) {
			logger.error('Cannot apply ' + file.filePath);
		}
		return Promise.resolve(success);
	}

	private async sendFile(file: File, app: any): Promise<boolean> {
		try {
			await this.attachFileAndSend(file.filePath, app);
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
	private async attachFileAndSend(filePath: string, app: any) {
		// get fileType and Filename
		let fileType: string;
		let fileName: string;
		let properNameField: string;
		let fileExtension: string;
		// eslint-disable-next-line prefer-const
		({ fileType, fileName, properNameField, fileExtension } = this.operationsBeforeObjectManipulation(filePath));
		// get the item for the update
		const obj = await app.getBusinessObject(fileType, 'ide_' + fileType);
		const item = await this.searchForUpdate(fileName, obj, properNameField, fileType, filePath);
		// give the field, ex: obo_script_id, scr_file
		const fieldScriptId = this.getProperScriptField(fileType);
		const doc = obj.getFieldDocument(fieldScriptId);
		if (doc === undefined) {
			throw new Error('No document returned, cannot update content');
		}
		// get the file content for setContent

		const fileContent = await workspace.findFiles('**/' + fileName + fileExtension);
		workspace.openTextDocument(fileContent[0]).then((document) => {
			const text = document.getText();
			doc.setContentFromText(text);
			obj.setFieldValue(fieldScriptId, doc);
			obj.update(item, { inlineDocuments: true }).then(() => {
				Promise.resolve();
			}).catch((e: Error) => {
				logger.error(e);
				throw e;
			});
		});
	}

	private operationsBeforeObjectManipulation(filePath: string): ReturnValueOperationsBeforeObjectManipulation {
		const fileType = this.getBusinessObjectType(filePath);
		const filePathDecomposed = crossPlatformPath(filePath).split('/');
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
		for (const object of this.devInfo.objects) {
			if (fileType === object.object) {
				return object.sourcefield;
			}
		}
	}

	private getProperNameField(fileType: string) {
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

	private async setDevInfo(app: any, moduleName?: string) { // uses the first instance available to fetch the data
		try {
			if (moduleName) {
				const currentModule = this.moduleHandler.getModuleFromName(moduleName);
				if (currentModule) {
					currentModule.moduleDevInfo = await app.getDevInfo(moduleName);
					this.moduleHandler.refreshTreeView(undefined);
				}
			} else {
				try {
					this.devInfo = await app.getDevInfo();
					this.moduleTreeView?.setDevInfo(this.devInfo);
				} catch (e) {
					console.log(e);
				}
			}
		} catch (e: any) {
			logger.error('get dev info: ' + e.message);
		}
	}

	async moduleDevInfoSpecific(connectedInstance: string, moduleName: string): Promise<void> { // need for completion handler in extension.ts
		const app = this.appHandler.getApp(connectedInstance);
		if (app.authtoken === undefined) {
			throw new Error(`Cannot get object fields, not connected to ${moduleName} (${connectedInstance})`);
		}
		await this.setDevInfo(app, moduleName);
	}

	async refreshModuleDevInfo(): Promise<void> {
		try {
			this.moduleHandler.setModules(await this.fileHandler.getSimpliciteModules(), true);
			for (const module of this.moduleHandler.modules) {
				if (this.moduleHandler.connectedInstancesUrl.includes(module.instanceUrl)) {
					await this.moduleDevInfoSpecific(module.instanceUrl, module.name);
				}
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

	setBarItem(barItem: BarItem): void {
		this.barItem = barItem;
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