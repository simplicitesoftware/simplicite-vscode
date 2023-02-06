'use strict';

import { SimpliciteInstance } from './SimpliciteInstance';
import { workspace, Memento, Uri, RelativePattern, commands, window } from 'vscode';
import { parseStringPromise } from 'xml2js';
import { ApiModuleSave, FileInstance, ModuleInfo, ModulePomInfo } from './interfaces';
import { Prompt } from './Prompt';
import { DevInfo } from './DevInfo';
import { ApiModule } from './ApiModule';
import { WorkspaceController } from './WorkspaceController';
import { Module } from './Module';
import { BarItem } from './BarItem';
import { resolve } from 'url';
import { HashService } from './HashService';

export class SimpliciteInstanceController {
	private prompt: Prompt;
	private _globalState: Memento;
	private apiModuleReset: boolean;
	private barItem: BarItem;
	devInfo: DevInfo | undefined;
	instances: Map<string, SimpliciteInstance>;
	constructor(prompt: Prompt, globalState: Memento, barItem: BarItem) {
		this.prompt = prompt;
		this._globalState = globalState;
		this.devInfo = undefined;
		this.instances = new Map();
		this.apiModuleReset = false;
		this.barItem = barItem;
	}

	async initAll(): Promise<void> {
		return new Promise(async (resolve) => {
			await this.setApiModuleAfterReset()
			.then(async () => await this.setSimpliciteInstancesFromWorkspace()
			.then(async () => await this.loginAll()
			.then(async () => await this.setApiModules()
			.then(async () => await this.clearApiModulesFiles()))));
			resolve();
		});
	}

	// AUTHENTICATION 

	async loginAll(): Promise<void> {
		return new Promise(async (resolve) => {
			for(const instance of this.instances.values()) {
				await this.loginInstance(instance.app.parameters.url);
			}
			resolve();
		});
	}

	async loginInstance(instanceUrl: string): Promise<boolean> {
		try {
			const instance = this.instances.get(instanceUrl);
			if (!instance) throw new Error(instanceUrl + ' cannot be found in known instances url');
			if(!instance.app.authtoken) await this.setCredentials(instance.app);
			await instance.login();
			await this.applyLoginValues(instance);
			return true;
		} catch(e: any) {
			// delete token in persistance. Usefull when token is expired
			await this.deleteToken(instanceUrl);
			console.error(e.message ? e.message : e);
			return false;
		}
	}

	private async applyLoginValues(instance: SimpliciteInstance) {
		if(!this.devInfo) this.devInfo = await instance.getDevInfo();
		if (this.devInfo) instance.setModulesDevInfo(this.devInfo).finally(async () => await commands.executeCommand('simplicite-vscode-tools.refreshModuleTree'));
		const authenticationValues: Array<{instanceUrl: string, authtoken: string}> = this._globalState.get(AUTHENTICATION_STORAGE) || [];
		const index = authenticationValues.findIndex((pair: {instanceUrl: string, authtoken: string}) => pair.instanceUrl === instance.app.parameters.url);
		if(index === -1) authenticationValues.push({instanceUrl: instance.app.parameters.url, authtoken: instance.app.authtoken});
		else authenticationValues[index].authtoken = instance.app.authtoken;
		await this._globalState.update(AUTHENTICATION_STORAGE, authenticationValues);
		this.barItem.show(Array.from(this.instances.values()));
	}

	private async deleteToken(instanceUrl: string) {
		const authenticationValues: Array<{instanceUrl: string, authtoken: string}> = this._globalState.get(AUTHENTICATION_STORAGE) || [];
		const index = authenticationValues.findIndex((pair: {instanceUrl: string, authtoken: string}) => pair.instanceUrl === instanceUrl);
		authenticationValues.splice(index, 1);
		await this._globalState.update(AUTHENTICATION_STORAGE, authenticationValues);
	}

	async logoutAll() {
		const logoutAll = new Promise(async (resolve) => {
			for(const inst of this.instances.values()) {
				await this.logoutInstance(inst.app.parameters.url);
			}
			resolve(null);
		});
		logoutAll.finally(async () => {
			await commands.executeCommand('simplicite-vscode-tools.refreshModuleTree');
		});
	}

	async logoutInstance(instanceUrl: string) {
		try {
			const instance = this.instances.get(instanceUrl);
			if (!instance) throw new Error(instanceUrl + 'cannot be found in known instances url');
			await instance.logout();
			this.barItem.show(Array.from(this.instances.values()));
		} catch(e) {
			console.error(e);
		}
	}

	async setCredentials(app: any) {
		const title = 'Simplicite: Authenticate to ' + app.parameters.url;
		const username = await this.prompt.simpleInput(title, 'username');
		const password = await this.prompt.simpleInput(title, 'password', true);
		app.setUsername(username);
		app.setPassword(password);
	}

	// MODULES INITIALIZATION 
	// scans the workspace folders and add module if found and conform
	// ignores the Api Modules
	async setSimpliciteInstancesFromWorkspace(): Promise<void> {
		return new Promise(async (resolve) => {
			console.log('Looking for valid modules in the workspace');
			const res = await this.getInstancesAndModulesFromWorkspace();
			for (const key of res.keys()) {
				if(!this.instances.has(key)) {
					const value = res.get(key);
					if(!value) continue;
					const instance = await this.getInstance(value, key);
					this.instances.set(key, instance);
				}
			}
			await commands.executeCommand('simplicite-vscode-tools.refreshFileHandler');
			resolve();
		});
	}

	private async getInstancesAndModulesFromWorkspace(): Promise<Map<string, ModuleInfo[]>> {
		let list: Map<string, ModuleInfo[]> = new Map();
		//const re = new RegExp('^([A-Za-z0-9_-]+@[A-Za-z0-9-_\.]+)$');
		const test = workspace.workspaceFolders;
		for (const wk of workspace.workspaceFolders || []) {
			await this.getModulesRecursive(wk.uri, list, null);
		}
		return list;
	}

	private async getModulesRecursive(wkUri: Uri, list: Map<string, ModuleInfo[]>, parentModuleInfo: ModuleInfo | null): Promise<void> {
		const pom = await this.getModulePom(wkUri);
		if(!pom) return;
		const res = await this.getModuleInfo(pom);
		if(res) {
			const moduleInfo: ModuleInfo = {name: res.name, wkUri: wkUri, modules: []};
			if(!parentModuleInfo) {
				if(!list.has(res.instanceUrl)) list.set(res.instanceUrl, [moduleInfo]);
				else list.get(res.instanceUrl)?.push(moduleInfo);
			} else {
				parentModuleInfo.modules.push(moduleInfo);
			}
			// look for pom.xml in subfolders
			for(const mod of res.subModules) {
				const relativePattern = new RelativePattern(wkUri, `**${mod}/pom.xml`);
				const files = await workspace.findFiles(relativePattern);
				for(const file of files) {
					if(file.scheme === 'file' && file.path !== wkUri.path + '/pom.xml') {
						await this.getModulesRecursive(Uri.parse(file.path.replace('/pom.xml', '')), list, moduleInfo);
					}
				}
			}
		}
	}

	private async getModulePom(wkUri: Uri) {
		const relativePattern = new RelativePattern(wkUri, 'pom.xml');
		const file = await workspace.findFiles(relativePattern);
		if (file.length === 0) return null;
		const pom = (await workspace.openTextDocument(file[0])).getText();
		const res = await parseStringPromise(pom);
		return res;
	}

	// returns an array with the instance url and moduleName
	private async getModuleInfo(pom: any): Promise<ModulePomInfo | null> {
		return {
			instanceUrl: pom.project.properties[0]['simplicite.url'][0], 
			name: pom.project['name'][0],
			subModules: this.getSubmodulesFromPom(pom)
		};
	}

	private getSubmodulesFromPom(pom: any): string[] {
		if(pom.project.modules && pom.project.modules.length > 0) {
			return pom.project.modules[0].module;
		}
		return [];
	}

	// api module states : is it already in workspace (might not be if workspace folder is empty)
	public async createApiModule(instanceUrl: string, moduleName: string): Promise<boolean> {
		console.log(`Attempting to create module ${moduleName} from ${instanceUrl} in workspace ${workspace.name}`);
		try {
			const instance = await this.getInstance([], instanceUrl);
			
			const apiModule = new ApiModule(moduleName, instanceUrl, instance.app, this._globalState, workspace.name);
			instance.modules.set(ApiModule.getApiModuleName(moduleName, instanceUrl), apiModule);
			// adding instance here, needs to be removed if process gets an error
			this.instances.set(instanceUrl, instance);
			const success = await this.loginInstance(instanceUrl);
			if(this.devInfo && success) {
				await apiModule.createProject(this.devInfo);
				const wkFoldersLength = workspace.workspaceFolders ? workspace.workspaceFolders.length : 0;
				if(wkFoldersLength === 0) {
					const ams: ApiModuleSave = { moduleName: moduleName, instanceUrl: instanceUrl, workspaceName: apiModule.workspaceName ? apiModule.workspaceName : 'Untitled (Workspace)'};
					await this._globalState.update(API_MODULE_ADDED_IN_EMPTY_WK, ams);
				} else {
					apiModule.saveApiModule();
				}
				WorkspaceController.addWorkspaceFolder(apiModule.apiModuleName);
				await apiModule.initFiles(instance.app, this._globalState, await WorkspaceController.getApiModuleWorkspacePath(moduleName, instanceUrl), []);
				
				return true;
			}
		} catch(e) {
			console.error(e);
			this.instances.delete(instanceUrl);
			return false;
		}
		return false;
	}

	// VS Code restarts when one folder is added in an empty workspace
	// this method creates the instance and module object instances
	private async setApiModuleAfterReset(): Promise<void> {
		return new Promise(async (resolve) => {
			const ams: ApiModuleSave | undefined = this._globalState.get(API_MODULE_ADDED_IN_EMPTY_WK);
			if(ams) {
				console.log('Creating api module after reset');
				try {
					this.apiModuleReset = true;
					const	instance = await SimpliciteInstance.build([], ams.instanceUrl, this._globalState);
					const apiModule = new ApiModule(ams.moduleName, ams.instanceUrl, instance.app, this._globalState, ams.workspaceName);
					instance.modules.set(ApiModule.getApiModuleName(ams.moduleName, ams.instanceUrl), apiModule);
					this.instances.set(ams.instanceUrl, instance);
					await apiModule.initFiles(instance.app, this._globalState, await WorkspaceController.getApiModuleWorkspacePath(ams.moduleName, ams.instanceUrl), []);
					apiModule.saveApiModule();
					await this._globalState.update(API_MODULE_ADDED_IN_EMPTY_WK, undefined);
				} catch(e) {
					this.instances.delete(ams.instanceUrl);
					console.error(e);
				}
			}
			resolve();
		});
	}

	private async setApiModules(): Promise<void> {
		return new Promise((resolve) => {
			// used to be if(!this.apiModuleReset) { 
			const saved: ApiModuleSave[] = this._globalState.get(API_MODULES) || [];
			saved.forEach(async (ams) => {
				if(ams.workspaceName === workspace.name || ams.workspaceName === 'Untitled (Workspace)' && !workspace.name /*&& ams.sessionId === env.sessionId*/) {
					await this.createApiModule(ams.instanceUrl, ams.moduleName);
				}
			});
			resolve();
		});
	}

	public async removeApiModule(moduleName: string, instanceUrl: string): Promise<boolean> {
		try {
			let instance = this.instances.get(instanceUrl);
			if(!instance) throw new Error('Cannot delete Api module, instance '+instanceUrl+' does not exist');
			const apiModuleName = ApiModule.getApiModuleName(moduleName, instanceUrl);
			const module = instance.modules.get(apiModuleName);
			if(!module || !(module instanceof ApiModule)) throw new Error('Cannot delete Api module, module '+moduleName+' does not exist, or is not an Api module');
			if(instance.modules.size === 1) await this.logoutInstance(instanceUrl); 
			instance.modules.delete(apiModuleName);
			await this.deleteApiModulePersistence(moduleName, instanceUrl);
			
			WorkspaceController.removeApiFileSystemFromWorkspace(moduleName, instanceUrl);
			console.log(`Succesfully removed ${moduleName}`);
			return true;
		} catch(e: any) {
			console.error(e.message + '. ');
			return false;
			//console.log('Trying to remove module '+instanceUrl+' folder from workspace');		
		}
	}

	// cannot be a method of api module because if module does not exist then cannot remove persistence (which is safer to do)
	private async deleteApiModulePersistence(moduleName: string, instanceUrl: string): Promise<void> {
		const saved: ApiModuleSave[] = this._globalState.get(API_MODULES) || [];
		const index = saved.findIndex((apiMS) => apiMS.instanceUrl === instanceUrl && apiMS.moduleName === moduleName);
		
		saved.splice(index, 1);
		await this._globalState.update(API_MODULES, saved);
		const clearFiles: any[] = this._globalState.get(API_MODULE_CLEAR_FILES) || [];
		clearFiles.push({name: moduleName, instanceUrl: instanceUrl});
		await this._globalState.update(API_MODULE_CLEAR_FILES, clearFiles);
		console.log(`Removed persistence of module ${moduleName} from ${instanceUrl}, clearing files on next VS Code start`);
	}

	private async clearApiModulesFiles(): Promise<void> {
		return new Promise(async (resolve) => {
			const clearFiles: any[] = this._globalState.get(API_MODULE_CLEAR_FILES) || [];
			clearFiles.forEach((value) => {
				ApiModule.deleteFiles(value.instanceUrl, value.name);
			});
			await this._globalState.update(API_MODULE_CLEAR_FILES, undefined);
			resolve();
		});
		
	}

	async removeModule(moduleName: string) {
		for (const key of this.instances.keys()) {
			const instance = this.instances.get(key)!;
			instance.deleteModule(moduleName);
			if(instance.modules.size === 0) {
				await instance.logout();
				this.instances.delete(key);
				// cannot delete instance before logout as instance has the responsability to disconnect
				// barItem refresh will be called 2 times in this case, light process but it can be optimised
				this.barItem.show(Array.from(this.instances.values()));
			}
		}
	}

	public deleteAllHashes() {
		this.instances.forEach((value) => {
			value.modules.forEach((modValue) => {
				modValue.deleteHashes();
			});
		});
	}

	// FILES

	public getFileAndInstanceUrlFromPath(uri: Uri): FileInstance | undefined {
		for (const instance of this.instances.values()) {
			for (const m of instance.modules.values()) {
				const file = m.getFileFromUriRecursive(uri);
				if(file) return {file: file, url: instance.app.parameters.url};
			}
		}
		return undefined;
	}

	public async sendAllFiles(): Promise<void> {
		const promises = [];
		for(const instance of this.instances.values()) {
			for(const module of instance.modules.values()) {
				promises.push(module.sendFiles());
			}
		}
		Promise.all(promises).then(async () => await commands.executeCommand('simplicite-vscode-tools.refreshFileHandler'));
	}

	public getModule(moduleName: string, instanceUrl: string): Module | undefined {
		const instance = this.instances.get(instanceUrl);
		if(!instance) {
			window.showErrorMessage(`Simplicite: ${instanceUrl} is not a known instance`);
			return;
		}
		const module = instance.getModuleFromName(moduleName);
		if(!module) {
			window.showErrorMessage(`Simplicite: ${moduleName} is not a known module`);
		}
		return module;
	}

	// get or create instance if it doesnt exist, set instance on map is still necessary
	private async getInstance(moduleNames: ModuleInfo[], instanceUrl: string): Promise<SimpliciteInstance> {
		if(!this.instances.has(instanceUrl)) return await SimpliciteInstance.build(moduleNames, instanceUrl, this._globalState);
		else return this.instances.get(instanceUrl)!;
	}

	public getAllModules() {
		let modArray: (Module | ApiModule)[] = [];
		this.instances.forEach((instance) => {
			modArray = modArray.concat(instance.getModulesAsArray());
		});
		return modArray;
	}

	public findInstanceUrlWithClue(moduleNameClue: string, urlClue: string, apiUrlClue: string): string | undefined {
		for (const url of this.instances.keys()) {
			if(url.includes(apiUrlClue)) {
				// if url looks good, check for the module to make sure the result is the right one
				const instance = this.instances.get(url);
				if(!instance) continue;
				if(instance.modules.has(`${moduleNameClue}@${urlClue}`)) return url;
			}
		}
	}
}