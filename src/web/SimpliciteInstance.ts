'use strict';

import { Module } from './Module';
import { ApiModule } from './ApiModule';
import { ApiModuleSave, ModuleInfo } from './interfaces';
import simplicite from 'simplicite';
import { commands, Memento, window, workspace } from 'vscode';
import { DevInfo } from './DevInfo';
import { CustomFile } from './CustomFile';

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

		const subModulesCreator = async(minfo: ModuleInfo) => {
			const subModules: Map<string, Module> = new Map();
			for(const mod of minfo.modules) {
				const subMod = await this.buildModule(minfo);
				if(subMod) {
					subMod.subModules = await subModulesCreator(mod); 
					subModules.set(mod.name, subMod);
				}
			}
			return subModules;
		};

		const modules: Map<string, Module> = new Map();
		for(const minfo of moduleInfos) {
			const module = await this.buildModule(minfo);
			if(module) {
				module.subModules = await subModulesCreator(minfo);
				modules.set(minfo.name, module);
			}
		}
		this.modules = modules;
	}

	private async buildModule(minfo: ModuleInfo): Promise<Module | undefined> {
		const reg = new RegExp('^.*([A-Za-z0-9_-]+@[A-Za-z0-9-_\.]+)$');
		if(!reg.test(minfo.wkUri.path)) {
			return await Module.build(minfo.name, this.app.parameters.url, this._globalState, this.app, minfo.wkUri, this.getSubModuleNames(minfo));
		} else {
			return await ApiModule.buildApi(minfo.name, this.app.parameters.url, this.app, this._globalState, undefined, minfo.wkUri, false);
		}
	}

	private getSubModuleNames(module: ModuleInfo): string[] {
		const moduleNames: string[] = [];
		module.modules.forEach((sub) => moduleNames.push(sub.name));
		return moduleNames;
	}

	private setAuthtoken() {
		const list: Array<{instanceUrl: string, authtoken: string}> = this._globalState.get(AUTHENTICATION_STORAGE) || [];
		list.forEach(a => {
			if(a.instanceUrl === this.app.parameters.url) this.app.authtoken = a.authtoken;
		});
	}

	public async createApiModule(moduleName: string, devInfo: any): Promise<boolean> {
		try {
			this.modules.set(moduleName, await ApiModule.buildApi(moduleName, this.app.parameters.url, this.app, this._globalState, devInfo, undefined, true));
			return true;
		} catch(e) {
			console.log(e);
			return false;
		}
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

	public getTrackedFiles(): CustomFile[] {
		let trackedFiles: CustomFile[] = [];
		this.modules.forEach((mod: Module | ApiModule) => {
			const files = mod.getTrackedFiles();
			trackedFiles = trackedFiles.concat(files);
		});
		return trackedFiles;
	}

	public getModuleTrackedFiles(moduleName: string): CustomFile[] {
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
		const promises = [];
		for(const m of this.modules.values()) {
			promises.push(m.setModuleDevInfo(devInfo, this.app));
		}
		await Promise.all(promises);
		return;
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

	public getModuleFromName(moduleName: string): Module | undefined {
		const recursive = function(module: Module): Module | undefined {
			if(module.name === moduleName) return module;
			for(const mod of module.subModules) {
				if(mod[0] === moduleName) {
					return mod[1];
				} else if(mod[1].subModules.size) {
					const foundMod = recursive(mod[1]);
					if(foundMod) return foundMod;
				}
			}
		};
		for(const mod of this.modules) {
			const foundModule = recursive(mod[1]);
			if(foundModule) return foundModule;
		}
	}
}