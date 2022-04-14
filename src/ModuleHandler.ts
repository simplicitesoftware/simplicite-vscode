'use strict';

import { logger } from './Log';
import { Module } from './Module';
import { workspace, RelativePattern, WorkspaceFolder, Memento, window } from 'vscode';
import { parseStringPromise } from 'xml2js';
import { BarItem } from './BarItem';
import { SimpliciteApi } from './SimpliciteApi';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { PomXMLData } from './interfaces';
import { DevInfo } from './DevInfo';
import { FileHandler } from './FileHandler';
import { ApiModule } from './ApiModule';
import { AppHandler } from './AppHandler';

export class ModuleHandler {
	modules: Array<Module | ApiModule>;
	connectedInstances: string[];
	private _globalState: Memento;
	private _barItem: BarItem;
	constructor(globalState: Memento, barItem: BarItem) {
		this.modules = [];
		this._globalState = globalState;
		this.connectedInstances = [];
		this._barItem = barItem;
	}

	static async build (globalState: Memento, barItem: BarItem, appHandler: AppHandler, simpliciteApi: SimpliciteApi): Promise<ModuleHandler> {
		const moduleHandler = new ModuleHandler(globalState, barItem);

		await moduleHandler.setModulesFromScratch(appHandler, simpliciteApi);
		return moduleHandler;
	}
	
	addModule (module: Module, onInitialization: boolean) {
		for (const mod of this.modules) {
			if (mod.name === module.name && mod.instanceUrl === module.instanceUrl) {
				window.showWarningMessage("Simplicité: "+mod.name +" from "+mod.instanceUrl+" is already added as a known module");
				return;
			}
		}
		if (module.workspaceFolderPath === '') {
			const wk = this.getWorkspaceFolderPath(module);
			module.workspaceFolderPath = wk ? wk : '';
		}
		// if not already in, add module to list
		this.modules.push(module);
		if (!onInitialization) this._moduleHasBeenModified(); // do not save the modules on initialization, but why ? todo
	}

	setWorkspaceFolderPathValueOnNewApiModule(wokspaceFolder: string): void {
		for (const mod of this.modules) {
			if (mod instanceof ApiModule && mod.workspaceFolderPath === '') {
				mod.workspaceFolderPath = wokspaceFolder;
				this.saveModules();
				break;
			}
		}
	}

	public removeModule (name: string, instanceUrl: string) {
		this.modules.forEach((mod: Module | ApiModule, i: number) => {
			if (mod instanceof ApiModule && mod.apiModuleName === ApiModule.getApiModuleName(name, instanceUrl) 
			|| !(mod instanceof ApiModule) && mod.name === name && mod.instanceUrl === instanceUrl) this.modules.splice(i, 1); 
		});
	}

	removeModuleFromWkPath(wkPath: string): Module | false {
		const tempModules = [];
		let module: Module | false = false;
		for (const mod of this.modules) {
			if (mod.workspaceFolderPath !== wkPath) {
				tempModules.push(mod);
			} else {
				module = mod;
			}
		}
		this.modules = tempModules;
		this._moduleHasBeenModified();
		return module;
	}

	async setModulesFromScratch(appHandler: AppHandler, simpliciteApi: SimpliciteApi) {
		// todo , check the way modules are persisted throughout the instances life cycle
		await this.setSimpliciteModulesFromDisk(appHandler, simpliciteApi);
		this.compareWithPersistence();
	}

	private compareWithPersistence() { // compare the initial modules found in the workspace with the persistent datas. Mandatory to get api file system module
		const parsedModule: Array<Module | ApiModule> = this._globalState.get('simplicite-modules-info') || [];
		for (const parMod of parsedModule) {
			for (const mod of this.modules) {
				if (parMod.name === mod.name && parMod.instanceUrl === mod.instanceUrl && parMod.token !== '') {
					mod.token = parMod.token;
					break;
				}
			}
			if (!(parMod instanceof ApiModule)) continue;
			window.showInformationMessage(`${workspace.name} ; ${parMod.workspaceName}`)
			if (parMod instanceof ApiModule && ( (!workspace.name && parMod.workspaceName === 'Untitled (Workspace)') || (workspace.name === parMod.workspaceName) ) ) {
				this.addModule(parMod, false);
			}
		}
		this._moduleHasBeenModified();
	}

	spreadToken(instanceUrl: string, token: string): void {
		for (const module of this.modules) {
			if (module.instanceUrl === instanceUrl) {
				module.token = token;
			}
		}
	}

	getModuleFromNameAndInstance(moduleName: string, instanceUrl: string): Module | ApiModule | null {
		for (const module of this.modules) {
			if (moduleName === module.name && instanceUrl === module.instanceUrl) return module;
		}
		return null;
	}

	getModuleFromName(moduleName: string, instanceUrl: string): Module | null {
		for (const module of this.modules) {
			if (!(module instanceof ApiModule) && moduleName === module.name && instanceUrl === module.instanceUrl) return module;
		}
		return null;
	}

	getApiModuleFromApiName(apiModuleName: string): ApiModule | null {
		for (const module of this.modules) {
			if (module instanceof ApiModule && apiModuleName === module.apiModuleName) return module;
		}
		return null;
	}

	getModuleFromWorkspacePath(wkPath: string): Module | ApiModule | null {
		for (const mod of this.modules) {
			if(wkPath === mod.workspaceFolderPath) return mod;
		}
		return null;
	}

	getFirstModuleFromInstance(instanceUrl: string): Module | ApiModule | null {
		for (const mod of this.modules) {
			if(mod.instanceUrl === instanceUrl) return mod;
		}
		return null;
	}

	getApiModuleOnly(): ApiModule[] {
		const apiModules: ApiModule[] = [];
		for(const mod of this.modules) {
			if(mod instanceof ApiModule) apiModules.push(mod);
		}
		return apiModules;
	}

	async setSimpliciteModulesFromDisk(appHandler: AppHandler, simpliciteApi: SimpliciteApi): Promise<void> {
		this.modules = [];
		if (workspace.workspaceFolders === undefined) return;
		for (const workspaceFolder of workspace.workspaceFolders) {
			try {
				const globPatern = '**/module-info.json'; // if it contains module-info.json -> simplicite module
				const relativePattern = new RelativePattern(workspaceFolder, globPatern);
				const moduleInfo = await workspace.findFiles(relativePattern);
				const pomXMLData: PomXMLData = await this.getModuleInstanceUrlAndNameFromDisk(workspaceFolder);
				if(pomXMLData.instanceUrl === '' && pomXMLData.name === '') continue;
				if(moduleInfo[0]) {
					this.addModule(new Module(pomXMLData.name, workspaceFolder.uri.path, pomXMLData.instanceUrl, ''), true);
				} else if (!moduleInfo.length) {
					this.addModule(new ApiModule(pomXMLData.name, workspaceFolder.uri.path, pomXMLData.instanceUrl, '', appHandler.getApp(pomXMLData.instanceUrl), simpliciteApi, workspace.name), true);
				}
			} catch (e: any) {
				logger.warn(e);
			}
		}
	}

	private async getModuleInstanceUrlAndNameFromDisk(workspaceFolder: WorkspaceFolder): Promise<PomXMLData> { // searches into pom.xml and returns the simplicite's instance url
		const globPatern = '**pom.xml';
		const relativePattern = new RelativePattern(workspaceFolder, globPatern);
		const file = await workspace.findFiles(relativePattern);
		if (file.length === 0) throw new Error('No pom.xml has been found');
		const pom = (await workspace.openTextDocument(file[0])).getText();
		const res = await parseStringPromise(pom);
		return {instanceUrl: res.project.properties[0]['simplicite.url'][0], name: res.project['name'][0]};
	}	

	getWorkspaceFolderPath(module: Module | ApiModule): string | false {
		if (!workspace.workspaceFolders) {
			return false;
		}
		for (const wk of workspace.workspaceFolders) {
			if (module instanceof ApiModule && wk.name === module.apiModuleName || module instanceof Module && wk.name ===  module.name) return wk.uri.path;
		}
		return false;
	}

	logoutModuleState(instanceUrl: string, moduleInfoTree: ModuleInfoTree, devInfo: DevInfo | undefined): void {
		this.removeConnectedInstance(instanceUrl);
		for (const mod of this.modules) {
			if (mod.instanceUrl === instanceUrl) {
				mod.connected = false;
				mod.moduleDevInfo = undefined;
				mod.token = '';
			}
		}
		moduleInfoTree.feedData(devInfo, this.modules);
		this._moduleHasBeenModified();
	}

	async loginModuleState(simpliciteApi: SimpliciteApi, module: Module | ApiModule, token: string, fileHandler: FileHandler): Promise<void> {
		this.addConnectedInstance(module.instanceUrl);
		for (const mod of this.modules) {
			if (mod.instanceUrl === module.instanceUrl) { // share connected values to every module from instance
				mod.connected = true;
				mod.token = token;
			}
		}
		await this.refreshModulesDevInfo(simpliciteApi, fileHandler);
		this._moduleHasBeenModified();
		// set api
		if (module instanceof ApiModule) {
			await module.initApiFileSystemModule();
		}
	}
	
	addConnectedInstance(instanceUrl: string): void {
		if (!this.connectedInstances.includes(instanceUrl)) this.connectedInstances.push(instanceUrl);
	}

	removeConnectedInstance(instanceUrl: string): void {
		if (this.connectedInstances.includes(instanceUrl)) {
			const index = this.connectedInstances.indexOf(instanceUrl);
			this.connectedInstances.splice(index, 1);
		}
	}

	saveModules (): void {
		// create new modules (api and non api) only saving meaningfull data 
		let tempMod: Array<Module | ApiModule> = [];
		for (const mod of this.modules) {
			if (mod instanceof ApiModule) tempMod.push(new ApiModule(mod.name, mod.workspaceFolderPath, mod.instanceUrl, mod.token, null, null, mod.workspaceName));
			else if (mod instanceof Module) tempMod.push(new Module(mod.name, mod.workspaceFolderPath, mod.instanceUrl, mod.token))
		}
		this._globalState.update('simplicite-modules-info', tempMod);
	}

	private _moduleHasBeenModified () { // save the modules and refresh bar item
		this.saveModules();
		this._barItem.show(this.modules, this.connectedInstances);
	}

	async refreshModulesDevInfo (simpliciteApi: SimpliciteApi, fileHandler: FileHandler): Promise<void> {
		for (const mod of this.modules) {
			if (mod.connected) {
				mod.moduleDevInfo = await simpliciteApi.fetchModuleInfo(mod.instanceUrl, mod.name);	
				fileHandler.setFilesModuleDevInfo(mod, simpliciteApi.devInfo!);
			}
			else mod.moduleDevInfo = undefined;
		}
	}

	getInstanceToken(instanceUrl: string): string {
		for (const mod of this.modules) {
			if (mod.instanceUrl === instanceUrl && mod.token !== '') {
				return mod.token;
			}
		}
		return '';
	}
}

