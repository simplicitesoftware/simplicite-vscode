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
		for (const module of parsedModuleState) {
			if (parsedModuleState.length > 0 && workspace.workspaceFolders) { // potentially get a module with remote file system
				const includes = this.getModuleFromWorkspacePath(module.workspaceFolderPath);
				if (module.remoteFileSystem && !includes && this.isRemoteModuleInWorkspace(workspace.workspaceFolders, module) || module.instanceJump ) {
					module.instanceJump = false;
					this.modules.push(module);
				}
			} if (this.modules.length > 0) {
				for (const mod of this.modules) {
					if (module.instanceUrl === mod.instanceUrl) {
						mod.token = module.token;
					} if (module.workspaceFolderPath === mod.workspaceFolderPath) {
						mod.remoteFileSystem = module.remoteFileSystem;
					}
				}
			}
		}
		// sort the list so the api file system appears first
		const tempModules = this.modules;
		this.modules = [];
		for (const module of tempModules) {
			if (module.remoteFileSystem) {
				this.modules.push(module);
			}
		}
		for (const module of tempModules) {
			if (!module.remoteFileSystem) {
				this.modules.push(module);
			}
		}
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
		const modules = [];
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
					modules.push(new Module(pomXMLData.name, workspaceFolder.uri.path, pomXMLData.instanceUrl, '', false, false));
				}
			} catch (e: any) {
				logger.warn(e);
			}
		}
		this.modules = modules;
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

	deleteModule(instanceUrl: string | undefined, moduleName: string | undefined): void {
		const moduleArray: Module[] = this.modules;
		const newInfo = [];
		if (moduleArray === null) {
			throw new Error('Error getting simplicite info content');
		}
		for (const module of moduleArray) {
			if (instanceUrl) {
				if (module.instanceUrl !== instanceUrl || module.remoteFileSystem) {
					newInfo.push(module);
				}
			} else if (moduleName) {
				if (module.name !== moduleName || module.remoteFileSystem) {
					newInfo.push(module);
				}
			}
		}
		this.modules = newInfo;
		this._globalState.update('simplicite-modules-info', newInfo);
	}
}

