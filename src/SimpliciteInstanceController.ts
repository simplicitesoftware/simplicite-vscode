'use strict';

import { SimpliciteInstance } from './SimpliciteInstance';
import { workspace, WorkspaceFolder, RelativePattern, Memento } from 'vscode';
import { parseStringPromise } from 'xml2js';
import { NameAndWorkspacePath, UrlAndName } from './interfaces';
import { logger } from './Log';
import { SimpliciteApi } from './SimpliciteApi';
import { Prompt } from './Prompt';
import { DevInfo } from './DevInfo';

export class SimpliciteInstanceController {
	simpliciteInstances: Map<string, SimpliciteInstance>;
	prompt: Prompt;
	devInfo: DevInfo | undefined;
	private _globalStorage: Memento;
	constructor(prompt: Prompt, globalStorage: Memento) {
		this.simpliciteInstances = new Map();
		this.prompt = prompt;
		this.devInfo = undefined;
		this._globalStorage = globalStorage;
	}

	static async build(prompt: Prompt, globalStorage: Memento) {
		const simpliciteInstanceController = new SimpliciteInstanceController(prompt, globalStorage);
		await simpliciteInstanceController.setSimpliciteInstancesFromWorkspace();
		return simpliciteInstanceController
	}

	// AUTHENTICATION --------------------------

	async loginAll() {
		this.simpliciteInstances.forEach(async (instance: SimpliciteInstance, url: string) => {
			await this.loginInstance(url);
		});
	}

	async loginInstance(instanceUrl: string) {
		try {
			const instance = this.simpliciteInstances.get(instanceUrl);
			if (!instance) throw new Error(instanceUrl + 'cannot be found in known instances url'); // make this a function ? redondant
			if(!instance.app.authtoken) await this.setCredentials(instance.app);
			await instance.login();
			await this.applyLoginValues(instance);
		} catch(e) {
			logger.error(e);
		}
	}

	async applyLoginValues(instance: SimpliciteInstance) {
		if(!this.devInfo) this.devInfo = await instance.getDevInfo();
		const authenticationValues: Array<{instanceUrl: string, authtoken: string}> = this._globalStorage.get(AUTHENTICATION_STORAGE) || [];
		authenticationValues.push({instanceUrl: instance.app.parameters.url, authtoken: instance.app.authtoken});
		this._globalStorage.update(AUTHENTICATION_STORAGE, authenticationValues);
	}

	async logoutAll() {
		this.simpliciteInstances.forEach(async (instance: SimpliciteInstance, url: string) => {
			await this.logoutInstance(url);
		})
	}

	async logoutInstance(instanceUrl: string) {
		try {
			const instance = this.simpliciteInstances.get(instanceUrl);
			if (!instance) throw new Error(instanceUrl + 'cannot be found in known instances url');
			await instance.logout();
		} catch(e) {
			logger.error(e);
		}
	}

	async setCredentials(app: any) {
		const title = 'Simplicite: Authenticate to ' + app.parameters.url;
		const username = await this.prompt.simpleInput(title, 'username');
		const password = await this.prompt.simpleInput(title, 'password', true);
		app.setUsername(username);
		app.setPassword(password);
	}

	// FILES ------------------------------------------------------------

	

	// MODULES INITIALIZATION -------------------------------------------

	async setSimpliciteInstancesFromWorkspace(): Promise<void> {
		const res = await this.getInstancesAndModulesFromWorkspace();
		for (const key of res.keys()) {
			if(!this.simpliciteInstances.has(key)) {
				const value = res.get(key);
				if(!value) continue;
				const instance = await SimpliciteInstance.build(value, key, this._globalStorage);
				this.simpliciteInstances.set(key, instance);
			}
		}
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
}