'use strict';

import { logger } from './Log';
import { Module } from './Module';
import { workspace, RelativePattern, WorkspaceFolder, Memento } from 'vscode';
import { parseStringPromise } from 'xml2js';
import { BarItem } from './BarItem';
import { SimpliciteApi } from './SimpliciteApi';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { PomXMLData } from './interfaces';
import { DevInfo } from './DevInfo';
import { FileHandler } from './FileHandler';

export class ModuleHandler {
	modules: Array<Module>;
	connectedInstances: string[];
	_globalState: Memento;
	_barItem: BarItem;
	constructor(globalState: Memento, barItem: BarItem) {
		this.modules = [];
		this._globalState = globalState;
		this.connectedInstances = [];
		this._barItem = barItem;
	}

	static async build (globalState: Memento, barItem: BarItem): Promise<ModuleHandler> {
		const moduleHandler = new ModuleHandler(globalState, barItem);

		await moduleHandler.setModulesFromScratch();
		return moduleHandler;
	}
	
	addModule (module: Module, onInitialization: boolean) {
		let flag = true;
		for (const mod of this.modules) {
			if (mod.name === module.name && mod.apiFileSystem === module.apiFileSystem) {
				flag = false;
			}
		}
		if (module.workspaceFolderPath === '' || module.parentFolderName === '') {
			const wk = this.getWorkspaceFolderPath(module);
			module.workspaceFolderPath = wk ? wk : '';
			module.parentFolderName = Module.computeParentFolderName(module.workspaceFolderPath);
		}
		// if not already in, add module to list
		if (flag) {
			this.modules.push(module);
			if (!onInitialization) this._moduleHasBeenModified(); // do not save the modules on initialization
		}
	}

	public removeModule (name: string, instanceUrl: string, isApi: boolean) {
		this.modules.forEach((mod: Module, i: number) => {
			if (isApi && mod.apiModuleName === name && mod.instanceUrl === instanceUrl) this.modules.splice(i, 1); 
		  else if (mod.name === name && mod.instanceUrl === instanceUrl) this.modules.splice(i, 1);
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

	async setModulesFromScratch() {
		await this.setSimpliciteModulesFromDisk();
		this.compareWithPersistence();
	}

	private compareWithPersistence() { // compare the initial modules found in the workspace with the persistent datas. Mandatory to get api file system module
		const parsedModule: Array<Module> = this._globalState.get('simplicite-modules-info') || [];
		for (const parMod of parsedModule) {
			if (this.modules.length === 0 && !parMod.apiFileSystem) { // if no module is not found on disk delete
				continue;
			} else if (!parMod.apiFileSystem) {
				let isModuleOnDisk = false;
				for (const mod of this.modules) {
					if (parMod.parentFolderName === mod.parentFolderName) {
						isModuleOnDisk = true;
					}
				}
				if (!isModuleOnDisk) {
					continue;
				} 
			}
			parMod.connected = false;
			this.addModule(parMod, false);
			if (parMod.token !== '') this.spreadToken(parMod.instanceUrl, parMod.token);
		}

	}

	spreadToken(instanceUrl: string, token: string): void {
		for (const module of this.modules) {
			if (module.instanceUrl === instanceUrl) {
				module.token = token;
			}
		}
	}

	getModuleFromName(moduleName: string, isApi: boolean): Module | undefined {
		for (const module of this.modules) {
			if (isApi && moduleName === module.name)	return module;
			else if (moduleName = module.name) return module;
		}
		return undefined;
	}


	getModuleFromParentFolder(parentFolderPath: string): Module | undefined {
		for (const module of this.modules) {
			if (module.parentFolderName === parentFolderPath) {
				return module;
			}
		}
		return undefined;
	}

	getModuleFromWorkspacePath(workspacePath: string): Module | undefined {
		for (const module of this.modules) {
			if (module.workspaceFolderPath === workspacePath) {
				return module;
			}
		}
		return undefined;
	}

	async setSimpliciteModulesFromDisk(): Promise<void> { // returns array of module objects
		if (workspace.workspaceFolders === undefined) {
			return;
		}			
		for (const workspaceFolder of workspace.workspaceFolders) {
			try {
				const globPatern = '**/module-info.json'; // if it contains module-info.json -> simplicite module
				const relativePattern = new RelativePattern(workspaceFolder, globPatern);
				const modulePom = await workspace.findFiles(relativePattern);
				if (modulePom.length === 0) {
					continue;
				}
				const pomXMLData: PomXMLData = await this.getModuleInstanceUrlAndNameFromDisk(workspaceFolder);
				if (modulePom[0]) {
					this.addModule(new Module(pomXMLData.name, workspaceFolder.uri.path, pomXMLData.instanceUrl, '', false, false), true);
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

	getWorkspaceFolderPath(module: Module): string | false {
		if (!workspace.workspaceFolders) {
			return false;
		}
		for (const wk of workspace.workspaceFolders) {
			if (wk.name ===  module.name && !module.apiFileSystem) return wk.uri.path;
			else if (wk.name === module.apiModuleName && module.apiFileSystem) return wk.uri.path;
		}
		return false;
	}

	logoutModuleState(instanceUrl: string, moduleInfoTree: ModuleInfoTree, devInfo: DevInfo | undefined): void {
		this.removeConnectedInstance(instanceUrl);
		for (const mod of this.modules) {
			if (mod.apiFileSystem) {
				this.removeModuleFromWkPath(mod.workspaceFolderPath);
			}
			if (mod.instanceUrl === instanceUrl) {
				mod.connected = false;
				mod.moduleDevInfo = undefined;
				mod.token = '';
			}
		}
		moduleInfoTree.feedData(devInfo, this.modules);
		this._moduleHasBeenModified();
	}

	async loginModuleState(simpliciteApi: SimpliciteApi, module: Module, token: string, fileHandler: FileHandler): Promise<void> {
		this.addConnectedInstance(module.instanceUrl);
		for (const mod of this.modules) {
			if (mod.instanceUrl === module.instanceUrl) { // share connected values to every module from instance
				mod.connected = true;
				mod.token = token;
			}
		}
		await this.refreshModulesDevInfo(simpliciteApi, fileHandler);
		this._moduleHasBeenModified();
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

	saveModules () {
		this._globalState.update('simplicite-modules-info', this.modules);
	}

	private _moduleHasBeenModified () { // save the modules and refresh bar item
		this.saveModules();
		this._barItem.show(this.modules, this.connectedInstances);
	}

	async refreshModulesDevInfo (simpliciteApi: SimpliciteApi, fileHandler: FileHandler): Promise<void> {
		for (const mod of this.modules) {
			if (mod.connected) {
				mod.moduleDevInfo = await simpliciteApi.fetchModuleInfo(mod.instanceUrl, mod.name);	
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

