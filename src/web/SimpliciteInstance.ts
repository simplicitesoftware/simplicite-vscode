'use strict';

import { Module } from './Module';
import { ApiModule } from './ApiModule';
import { ModuleInfo } from './interfaces';
import simplicite from 'simplicite';
import { commands, Memento, window } from 'vscode';
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

	static async build(moduleInfos: ModuleInfo[], url: string, globalState: Memento): Promise<SimpliciteInstance> {
		const simpliciteInstance = new SimpliciteInstance(url, globalState);
		simpliciteInstance.setAuthtoken();
		await simpliciteInstance.initModules(moduleInfos);
		return simpliciteInstance;
	}

	async initModules(moduleInfos: ModuleInfo[]): Promise<void> {
		if(moduleInfos.length === 0) return;

		const subModulesCreator = async(module: Module, minfo: ModuleInfo) => {
			for(const mod of minfo.modules) {
				const subMod = await Module.build(mod.name, this.app.parameters.url, this._globalState, this.app, mod.wkUri);
				module.subModules.set(mod.name, subMod);
				await subModulesCreator(subMod, mod);
			}
		};

		const modules: Map<string, Module> = new Map();
		for(const minfo of moduleInfos) {
			const module = await Module.build(minfo.name, this.app.parameters.url, this._globalState, this.app, minfo.wkUri);
			await subModulesCreator(module, minfo);
			modules.set(minfo.name, module);
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
			console.log(msg);
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
			console.log(msg);
		} catch (e: any) {
			console.error(e);
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
			modFiles.push({moduleName: name, files: mod.getFilesPathAsArray()});
		});
		return modFiles;
	}

	// DEV INFO 

	async getDevInfo() {
		try {
			const devInfo = await this.app.getDevInfo();
			return new DevInfo(devInfo);
		} catch(e) {
			console.error(e);
		}
	}

	public async setModulesDevInfo(devInfo: DevInfo) {
		this.modules.forEach(async (m: Module | ApiModule) => await m.setModuleDevInfo(devInfo, this.app));
	}

	// BACKEND COMPILATION

	public async triggerBackendCompilation() {
		try {
			const obj = this.app.getBusinessObject('Script', 'ide_Script');
			this.isBackendCompiling = true;
			const _this = this;
			const res = obj.action('CodeCompile', 0).then(() => {
				_this.isBackendCompiling = false;
			});
			if(res !== 'OK#INFO') throw new Error(res);
			console.log('Backend compilation completed');
		} catch(e: any) {
			this.isBackendCompiling = false;
			window.showErrorMessage('Simplicite: ' + e.message ? e.message : e);
			console.error(e);
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