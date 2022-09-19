'use strict';

import { Module } from './Module';
import { ApiModule } from './ApiModule';
import { InstanceModules, ModulesFiles, NameAndWorkspacePath } from './interfaces';
import simplicite from 'simplicite';
import { commands, Memento, window } from 'vscode';
import { logger } from './Log';
import { DevInfo } from './DevInfo';
import { File } from './File';

// represent a simplicite instance
export class SimpliciteInstance {
	modules: Map<string, Module | ApiModule>;
	app: any;
	isBackendCompiling: boolean;
	private _globalState: Memento;
	constructor(instanceUrl: string, globalState: Memento) {
		this.modules = new Map();
		this.app = simplicite.session({ url: instanceUrl /*, debug: true*/ });
		this._globalState = globalState;
		this.isBackendCompiling = false;
	}

	static async build(modulesName: NameAndWorkspacePath[], url: string, globalState: Memento): Promise<SimpliciteInstance> {
		const simpliciteInstance = new SimpliciteInstance(url, globalState);
		simpliciteInstance.setAuthtoken();
		await simpliciteInstance.initModules(modulesName);
		return simpliciteInstance;
	}

	async initModules(modulesName: NameAndWorkspacePath[]): Promise<void> {
		const modules: Map<string, Module> = new Map();
		for (const value of modulesName) {
			if(!modules.has(value.name)) {
				const module = new Module(value.name, this.app.parameters.url);
				await module.initFiles(this.app, this._globalState, value.wkPath);
				modules.set(value.name, module);
			}
		}
		this.modules = modules;
	}

	private setAuthtoken() {
		const list: Array<{instanceUrl: string, authtoken: string}> = this._globalState.get(AUTHENTICATION_STORAGE) || [];
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
			throw new Error(e.message);
		}
	}

	async logout(): Promise<void> {
		try {
			await this.app.logout();
			const msg = 'Simplicite: Logged out from ' + this.app.parameters.url;
			await this.removeTokenPersistence();
			window.showInformationMessage(msg);
			logger.info(msg);
		} catch (e: any) {
			logger.error(e);
			window.showErrorMessage('Simplicite: ' + e.message);
		}
	}

	private async removeTokenPersistence() {
		const authenticationValues: Array<{instanceUrl: string, authtoken: string}> = this._globalState.get(AUTHENTICATION_STORAGE) || [];
		const index = authenticationValues.findIndex((pair: {instanceUrl: string, authtoken: string}) => pair.instanceUrl === this.app.parameters.url);
		if(index !== -1) authenticationValues.splice(index, 1);
		await this._globalState.update(AUTHENTICATION_STORAGE, authenticationValues);
	}

	// FILES

	public getTrackedFiles(): File[] {
		let trackedFiles: File[] = [];
		this.modules.forEach((mod: Module | ApiModule) => {
			const files = mod.getTrackedFiles();
			trackedFiles = trackedFiles.concat(files);
		});
		return trackedFiles;
	}

	public getModuleTrackedFiles(moduleName: string): File[] {
		const mod = this.modules.get(moduleName);
		if(!mod) return [];
		return mod.getTrackedFiles();
	}

	public getFilesAssiociatedToModules(): Array<{moduleName: string, files: string[]}> {
		const modFiles : Array<{moduleName: string, files: string[]}> = [];
		this.modules.forEach((mod: Module | ApiModule, name: string) => {
			modFiles.push({moduleName: name, files: mod.getFilesAsArray()});
		});
		return modFiles;
	}

	// DEV INFO 

	async getDevInfo() {
		try {
			const devInfo = await this.app.getDevInfo();
			return new DevInfo(devInfo);
		} catch(e) {
			logger.error(e);
		}
	}

	private async getModuleDevInfo(moduleName: string) {
		try {
			const moduleDevInfo = await this.app.getDevInfo(moduleName);
			return moduleDevInfo;
		} catch(e: any) {
			throw new Error(e);
		}
	}

	public async setModulesDevInfo(devInfo: DevInfo) {
		this.modules.forEach(async (m: Module | ApiModule, name: string) => {
			await this.setSingleModuleDevInfo(devInfo, m instanceof ApiModule ? m.name : name, m);
		});
	}

	public async setSingleModuleDevInfo(devInfo: DevInfo, moduleName: string, module: Module | ApiModule) {
		try {
			const moduleDevInfo = await this.getModuleDevInfo(moduleName);
			module.setModuleDevInfo(moduleDevInfo, devInfo);
			await commands.executeCommand('simplicite-vscode-tools.refreshModuleTree');
		} catch(e) {
			logger.error(e);
		}
		
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
	
// UTIL
 
 	public deleteModule(moduleName: string) {
		for (const key of this.modules.keys()) {
			const module = this.modules.get(key)!;
			if(module.name === moduleName || module instanceof ApiModule && module.apiModuleName === moduleName) {
				this.modules.delete(key);
			}
		}
 	}

	public getModulesAsArray() {
		const mods: (Module | ApiModule)[] = [];
		this.modules.forEach((mod) => mods.push(mod));
		return mods;
	}
}