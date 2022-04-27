'use strict';

import { Module } from './Module';
import { ApiModule } from './ApiModule';
import { InstanceModules, ModulesFiles, NameAndWorkspacePath } from './interfaces';
import simplicite from 'simplicite';
import { Memento, Uri, window } from 'vscode';
import { logger } from './Log';
import { DevInfo } from './DevInfo';
import { File } from './File';
import { stringify, StringifyOptions } from 'querystring';

// represent a simplicite instance
export class SimpliciteInstance {
	modules: Map<string, Module>;
	apiModules: Map<string, ApiModule>;
	app: any;
	isBackendCompiling: boolean;
	private _globalStorage: Memento;
	constructor(instanceUrl: string, globalStorage: Memento) {
		this.modules = new Map();
		this.apiModules = new Map();
		this.app = simplicite.session({ url: instanceUrl /*, debug: true*/ });
		this._globalStorage = globalStorage;
		this.isBackendCompiling = false;
	}

	static async build(modulesName: NameAndWorkspacePath[], url: string, globalStorage: Memento): Promise<SimpliciteInstance> {
		const simpliciteInstance = new SimpliciteInstance(url, globalStorage);
		simpliciteInstance.setAuthtoken();
		await simpliciteInstance.initModules(modulesName);
		simpliciteInstance.setFilesStatusStorage(url);
		return simpliciteInstance;
	}

	async initModules(modulesName: NameAndWorkspacePath[]): Promise<void> {
		const modules: Map<string, Module> = new Map();
		for (const value of modulesName) {
			if(!modules.has(value.name)) {
				const module = await Module.build(value.wkPath, this._globalStorage);
				modules.set(value.name, module);
			}
		}
		this.modules = modules;
	}

	private setAuthtoken() {
		const list: Array<{instanceUrl: string, authtoken: string}> = this._globalStorage.get(AUTHENTICATION_STORAGE) || [];
		list.forEach(a => {
			if(a.instanceUrl === this.app.parameters.url) this.app.authtoken = a.authtoken;
		});
	}

	async login(): Promise<void> {
		try {
			const res = await this.app.login();
			this.app.setPassword('');
			const msg  = 'Logged in as ' + res.login + ' at: ' + this.app.parameters.url;
			window.showInformationMessage('Simplicite: ' + msg);
			logger.info(msg);
		} catch (e: any) {
			this.app.setAuthToken('');
			window.showErrorMessage('Simplicite: ' + e.message ? e.message : e);
			throw new Error(e);
		}
	}

	async logout(): Promise<void> {
		try {
			await this.app.logout();
			const msg = 'Simplicite: Logged out from ' + this.app.parameters.url;
			window.showInformationMessage(msg);
			logger.info(msg);
		} catch (e: any) {
			logger.error(e);
			window.showErrorMessage('Simplicite: ' + e.message);
		}
	}

	

	

	// FILES

	public async sendFile(file: File) {
		try {
			const obj = this.app.getBusinessObject(file.type, 'ide_' + file.type);
			const item = await obj.getForUpdate(file.rowId, { inlineDocuments: true });
			const doc = obj.getFieldDocument(file.scriptField);
			if (doc === undefined) throw new Error('No document returned, cannot update content');
			
			const content = await File.getContent(file.uri);
			doc.setContentFromText(content);
			obj.setFieldValue(file.scriptField, doc);
			const res = await obj.update(item, { inlineDocuments: true });
			if (!res) {
				window.showErrorMessage('Simplicite: Cannot synchronize ' + file.uri.path);
				return false;
			}
		} catch(e) {
			logger.error(e);
			return false;
		}
	}

	public setFilesStatus(files: File[], status: boolean) {
		this.modules.forEach((mod: Module) => {
			mod.setFileStatus(files, status);
		})
	}

	public getFilesAssiociatedToModules(): Array<{moduleName: string, files: string[]}> {
		const modFiles : Array<{moduleName: string, files: string[]}> = [];
		this.modules.forEach((mod: Module, name: string) => {
			modFiles.push({moduleName: name, files: mod.getFilesAsArray()});
		});
		return modFiles;
	}

	setFilesStatusStorage(url: string): void {
		const storedValues: Array<InstanceModules> | undefined = this._globalStorage.get(FILES_STATUS_STORAGE);
		if(!storedValues) return;
		for (const v of storedValues) {
			if(v.url === url) {
				this.modules.forEach((mod: Module, name: string) => {
					v.modules.forEach((modFiles: ModulesFiles) => {
						if(modFiles.moduleName === name) mod.setFilesStatusStorage(modFiles.files);
					})
				})
			}
		}
	}

	// DEV INFO 

	async getDevInfo() {
		try {
			return new DevInfo(await this.app.getDevInfo());
		} catch(e) {
			logger.error(e);
		}
	}

	private async getModuleDevInfo(moduleName: string) {
		try {
			return await this.app.getDevInfo(moduleName);
		} catch(e: any) {
			throw new Error(e);
		}
	}

	public async getModulesDevInfo(devInfo: DevInfo) {
		this.modules.forEach(async (m: Module, name: string) => {
			const moduleDevInfo = await this.getModuleDevInfo(name);
			await m.setModuleDevInfo(moduleDevInfo, devInfo);
		});
	}

	// BACKEND COMPILATION

	public async triggerBackendCompilation() {
		try {
			const obj = this.app.getBusinessObject('Script', 'ide_Script');
			this.isBackendCompiling = true;
			const res = await obj.action('CodeCompile', 0);
			if(res !== 'OK#INFO') throw new Error(res);
			this.isBackendCompiling = false; // check for this
			logger.info('Backend compilation completed');
		} catch(e: any) {
			this.isBackendCompiling = false;
			window.showErrorMessage('Simplicite: ' + e.message ? e.message : e);
			logger.error(e);
		}
	}

	
}