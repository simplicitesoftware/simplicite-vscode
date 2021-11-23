'use strict';

import { logger } from './Log';
import { Module } from './Module';
import { crossPlatformPath } from './utils';
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

	moduleLength(): number {
		return this.modules.length;
	}

	private setSavedData() {
		const parsedModuleState: Array<Module> = this._globalState.get('simplicite-modules-info') || [];
		for (const stateModule of parsedModuleState) {
			if (this.modules.length === 0 && parsedModuleState.length > 0) { // potentially get a module with remote file system
				for (const module of parsedModuleState) {
					if (module.remoteFileSystem) {
						this.modules.push(module);
					}
				}
			} else if (this.modules.length > 0) {
				for (const module of this.modules) {
					if (stateModule.instanceUrl === module.instanceUrl) {
						module.token = stateModule.token;
						module.remoteFileSystem = stateModule.remoteFileSystem;
					}
				}
			}
			
		}
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
				if (module.workspaceFolderPath === crossPlatformPath(workspacePath)) {
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
					modules.push(new Module(pomXMLData.name, crossPlatformPath(workspaceFolder.uri.path), pomXMLData.instanceUrl, '', false));
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
		const moduleArray: Module[] = this._globalState.get('simplicite-modules-info') || [];
		const newInfo = [];
		if (moduleArray === null) {
			throw new Error('Error getting simplicite info content');
		}
		for (const module of moduleArray) {
			if (instanceUrl) {
				if (module.instanceUrl !== instanceUrl) {
					newInfo.push(module);
				}
			} else if (moduleName) {
				if (module.name !== moduleName) {
					newInfo.push(module);
				}
			}
		}
		this._globalState.update('simplicite-modules-info', newInfo);
	}
}

