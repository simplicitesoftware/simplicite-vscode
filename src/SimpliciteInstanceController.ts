'use strict';

import { SimpliciteInstance } from './SimpliciteInstance';
import { workspace, WorkspaceFolder, RelativePattern } from 'vscode';
import { parseStringPromise } from 'xml2js';
import { NameAndWorkspacePath, UrlAndName } from './interfaces';
import { logger } from './Log';
import { SimpliciteApi } from './SimpliciteApi';

export class SimpliciteInstanceController {
	simpliciteInstances: Map<string, SimpliciteInstance>;
	api: SimpliciteApi;
	constructor(api: SimpliciteApi) {
		this.simpliciteInstances = new Map();
		this.api = api;
	}

	async loginAll() {
		this.simpliciteInstances.forEach(async (instance: SimpliciteInstance) => {
			await this.api.login(instance.app);
		});
	}

	// MODULES INITIALIZATION -------------------------------------------

	async setSimpliciteInstancesFromWorkspace(): Promise<void> {
		const res = await this.getInstancesAndModulesFromWorkspace();
		res.forEach((value: NameAndWorkspacePath[], key: string) => {
			if(!this.simpliciteInstances.has(key)) this.simpliciteInstances.set(key, new SimpliciteInstance(value, key));
		});
	}

	private async getInstancesAndModulesFromWorkspace(): Promise<Map<string, NameAndWorkspacePath[]>> {
		const list: Map<string, NameAndWorkspacePath[]> = new Map();
		for (const wk of workspace.workspaceFolders || []) {
			try {
				const res: UrlAndName = await this.getModuleUrlAndNameFromWorkspace(wk);
				if(!list.has(res.instanceUrl)) list.set(res.instanceUrl, [{name: res.name, wkPath: wk.uri.path}]);
				else list.get(res.instanceUrl)?.push({name: res.name, wkPath: wk.uri.path});
			} catch(e) {
				logger.error(e);
			}
		}
		return list;
	}

	// returns an array with the instance url and moduleName
	private async getModuleUrlAndNameFromWorkspace(workspaceFolder: WorkspaceFolder): Promise<UrlAndName> {
		const relativePattern = new RelativePattern(workspaceFolder, '**pom.xml');
		const file = await workspace.findFiles(relativePattern);
		if (file.length === 0) throw new Error('No pom.xml has been found');
		const pom = (await workspace.openTextDocument(file[0])).getText();
		const res = await parseStringPromise(pom);
		return {instanceUrl: res.project.properties[0]['simplicite.url'][0], name: res.project['name'][0]};
	}

	// MODULES INITIALIZATION -------------------------------------------
}