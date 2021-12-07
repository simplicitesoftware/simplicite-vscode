'use strict';

import { logger } from './Log';
import { Module } from './Module';
import { workspace, RelativePattern, WorkspaceFolder, Memento } from 'vscode';
import { parseStringPromise } from 'xml2js';
import { PomXMLData } from './interfaces';

export class ModuleHandler {
	modules: Array<Module>;
	connectedInstancesUrl: Array<string>;
	_globalState: Memento;
	constructor(globalState: Memento) {
		this.connectedInstancesUrl = [];
		this.modules = [];
		this._globalState = globalState;
	}

	static async build (globalState: Memento): Promise<ModuleHandler> {
		const moduleHandler = new ModuleHandler(globalState);
		await moduleHandler.setSimpliciteModulesFromDisk();
		moduleHandler.setSavedData();
		return moduleHandler;
	}

	addInstanceUrl(instanceUrl: string): void {
		if (!this.connectedInstancesUrl.includes(instanceUrl)) {
			this.connectedInstancesUrl.push(instanceUrl);
		}
	}
	
	addModule (module: Module) {
		let flag = true;
		for (const mod of this.modules) {
			if (mod.name === module.name && mod.remoteFileSystem === module.remoteFileSystem) {
				flag = false;
			}
		}
		// if not already in, add module to list
		if (module.workspaceFolderPath === '') {
			const wk = this.getWorkspaceFolderPath(module);
			module.workspaceFolderPath = wk ? wk : '';
		}
		if (flag) {
			this.modules.push(module);
		}
	}

	removeModuleFromWkPath (wkPath: string): Module | false {
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
		this.saveModules();
		return module;
	}

	getTokenIfExist (instanceUrl: string): string {
		for (const mod of this.modules) {
			if (mod.instanceUrl === instanceUrl && mod.token !== '' && mod.token !== null) {
				return mod.token;
			}
		}
		return '';
	}

	moduleLength(): number {
		return this.modules.length;
	}

	setSavedData() {
		const parsedModuleState: Array<Module> = this._globalState.get('simplicite-modules-info') || [];
		for (const mod of parsedModuleState) {
			if (mod.remoteFileSystem) {
				mod.instanceJump = false;
				this.addModule(mod);
			} else {
				const res = this.isModule(mod);
				if (res && mod.token) {
					this.spreadToken(mod.instanceUrl, mod.token);
				} else if (!res) {
					this.addModule(mod);
				}
			}
		}
		// sort the list so the api file system appears first
		const tempModules = this.modules;
		this.modules = [];
		for (const module of tempModules) {
			if (module.remoteFileSystem) {
				this.addModule(module);
			}
		}
		for (const module of tempModules) {
			if (!module.remoteFileSystem) {
				this.addModule(module);
			}
		}
		this.spreadAllToken();
	}

	isModule (mod: Module): boolean {
		for (const module of this.modules) {
			if (this.compareLowcase(module, mod)) {
				return true;
			}
		}
		return false;
	}

	compareLowcase (mod1: Module, mod2: Module): boolean {
		if (mod1.workspaceFolderPath.toLowerCase() === mod2.workspaceFolderPath.toLowerCase()) {
			return true;
		}
		return false;
	}

	isRemoteModuleInWorkspace (wks: readonly WorkspaceFolder[], module: Module): boolean {
		for (const wk of wks) {
			if (wk.name === 'Api_' + module.name) {
				return true;
			}
		}
		return false;
	}

	spreadToken(instanceUrl: string, token: string): void {
		for (const module of this.modules) {
			if (module.instanceUrl === instanceUrl) {
				module.token = token;
			}
		}
	}

	spreadAllToken() {
		for (const module of this.modules) {
			if (module.token !== '' && module.token !== null) {
				this.spreadToken(module.instanceUrl, module.token);
			}
		}
	}

	getModuleFromName(moduleName: string): Module | undefined {
		for (const module of this.modules) {
			if (module.name === moduleName) {
				return module;
			}
		}
		return undefined;
	}

	getModuleFromWorkspacePath(workspacePath: string): Module | false {
		try {
			for (const module of this.modules) {
				if (module.workspaceFolderPath === workspacePath) {
					return module;
				}
			}
		} catch (e) {
			logger.error(e);
		}
		return false;
	}

	removeConnectedInstancesUrl(instanceUrl: string): void {
		const index = this.connectedInstancesUrl.indexOf(instanceUrl);
		this.connectedInstancesUrl.splice(index, 1);
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
					throw new Error('No module found');
				}
				const pomXMLData: PomXMLData = await this.getModuleInstanceUrlAndNameFromDisk(workspaceFolder);
				if (modulePom[0]) {
					this.addModule(new Module(pomXMLData.name, workspaceFolder.uri.path, pomXMLData.instanceUrl, '', false, false));
				}
			} catch (e: any) {
				logger.warn(e);
			}
		}
	}

	getSimpliciteRFSModules (): Module | undefined {
		for (const module of this.modules) {
			if (module.remoteFileSystem) {
				return module;
			}
		}
		return undefined;
	}

	private async getModuleInstanceUrlAndNameFromDisk(workspaceFolder: WorkspaceFolder): Promise<PomXMLData> { // searches into pom.xml and returns the simplicite's instance url
		const globPatern = '**pom.xml';
		const relativePattern = new RelativePattern(workspaceFolder, globPatern);
		const file = await workspace.findFiles(relativePattern);
		if (file.length === 0) {
			throw new Error('No pom.xml has been found');
		}
		const pom = (await workspace.openTextDocument(file[0])).getText();
		const res = await parseStringPromise(pom);
		return {instanceUrl: res.project.properties[0]['simplicite.url'][0], name: res.project['name'][0]};
	}

	saveModules () {
		this._globalState.update('simplicite-modules-info', this.modules);
	}

	removeModuleFromInstance(instanceUrl: string): void {
		const moduleArray: Module[] = this.modules;
		const newInfo = [];
		if (moduleArray === null) {
			throw new Error('Error getting simplicite info content');
		}
		for (const module of moduleArray) {
			if (module.instanceUrl !== instanceUrl) {
				newInfo.push(module);
			}
		}
		this.modules = newInfo;
		this._globalState.update('simplicite-modules-info', newInfo);
	}

	afterConnectionModule (module: Module, token: string) {
		this.spreadToken(module.instanceUrl, token);
		this.addInstanceUrl(module.instanceUrl);
		this.saveModules();
	}

	getWorkspaceFolderPath(module: Module): string | false {
		if (!workspace.workspaceFolders) {
			return false;
		}
		for (const wk of workspace.workspaceFolders) {
			if (wk.name ===  'Api_' + module.name) {
				return wk.uri.path;
			}
		}
		return false;
	}
}

