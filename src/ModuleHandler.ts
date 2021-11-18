'use strict';

import { logger } from './Log';
import { Module } from './Module';
import { ModuleInfoTree } from './treeView/ModuleInfoTree';
import { crossPlatformPath } from './utils';
import { workspace, RelativePattern, WorkspaceFolder } from 'vscode';
import { parseStringPromise } from 'xml2js';

export class ModuleHandler {
	modules: Array<Module>;
	connectedInstancesUrl: Array<string>;
	moduleInfoTree?: ModuleInfoTree;
	constructor() {
		this.connectedInstancesUrl = [];
		this.modules = [];
	}

	static async build (): Promise<ModuleHandler> {
		const moduleHandler = new ModuleHandler();
		await moduleHandler.setSimpliciteModulesFromDisk();
		return moduleHandler;
	}

	addInstanceUrl(instanceUrl: string): void {
		if (!this.connectedInstancesUrl.includes(instanceUrl)) {
			this.connectedInstancesUrl.push(instanceUrl);
		}
	}

	removeInstanceUrl(instanceUrl: string): void {
		const index = this.connectedInstancesUrl.indexOf(instanceUrl);
		this.connectedInstancesUrl.splice(index, 1);
	}

	moduleLength(): number {
		return this.modules.length;
	}

	spreadToken(instanceUrl: string, token: string | null): void {
		for (const module of this.modules) {
			if (module.instanceUrl === instanceUrl) {
				module.token = token;
			}
		}
	}

	getDisconnectedModules(): Module[] { // useful ?
		const disconnectedModules = [];
		for (const module of this.modules) {
			if (!module.token) {
				disconnectedModules.push(module);
			}
		}
		return disconnectedModules;
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

	getAllModuleDevInfo(): Array<any> {
		const returnValue = [];
		for (const module of this.modules) {
			returnValue.push(module.moduleDevInfo);
		}
		return returnValue;
	}

	async setSimpliciteModulesFromDisk(): Promise<void> { // returns array of module objects
		const modules = [];
		try {
			if (workspace.workspaceFolders === undefined) {
				throw new Error('No workspace detected');
			}
			for (const workspaceFolder of workspace.workspaceFolders) {
				const globPatern = '**/module-info.json'; // if it contains module-info.json -> simplicite module
				const relativePattern = new RelativePattern(workspaceFolder, globPatern);
				const modulePom = await workspace.findFiles(relativePattern);
				if (modulePom.length === 0) {
					throw new Error('No module found');
				}
				const pomXMLData: PomXMLData = await this.getModuleInstanceUrlAndNameFromDisk(workspaceFolder);
				if (modulePom[0]) {
					modules.push(new Module(pomXMLData.name, crossPlatformPath(workspaceFolder.uri.path), pomXMLData.instanceUrl, ''));
				}
			}
		} catch (e: any) {
			logger.warn(e);
		}
		this.modules = modules;
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

	async getFreshModulesAndSet (): Promise<Module[]> {
		await this.setSimpliciteModulesFromDisk();
		return this.modules;
	}
}
interface PomXMLData {
	instanceUrl: string,
	name: string
}