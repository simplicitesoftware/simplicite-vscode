'use strict';

import { SimpliciteInstance } from './SimpliciteInstance';
import { workspace, WorkspaceFolder, RelativePattern, Memento, Uri, SnippetString } from 'vscode';
import { parseStringPromise } from 'xml2js';
import { ApiModuleSave, FileInstance, NameAndWorkspacePath, UrlAndName } from './interfaces';
import { logger } from './Log';
import { Prompt } from './Prompt';
import { DevInfo } from './DevInfo';
import { File } from './File';
import { ApiModule } from './ApiModule';
import { WorkspaceController } from './WorkspaceController';
import { info } from 'console';
import { throws } from 'assert';

export class SimpliciteInstanceController {
	private prompt: Prompt;
	private _globalState: Memento;
	devInfo: DevInfo | undefined;
	simpliciteInstances: Map<string, SimpliciteInstance>;
	constructor(prompt: Prompt, globalState: Memento) {
		this.prompt = prompt;
		this._globalState = globalState;
		this.devInfo = undefined;
		this.simpliciteInstances = new Map();
	}

	async initAll() {
		await this.clearExpiredApiModules();
		await this.setApiModuleAfterReset();
		await this.setSimpliciteInstancesFromWorkspace();
	}

	// AUTHENTICATION 

	async loginAll() {
		this.simpliciteInstances.forEach(async (instance: SimpliciteInstance, url: string) => {
			await this.loginInstance(url);
		});
	}

	async loginInstance(instanceUrl: string): Promise<boolean> {
		try {
			const instance = this.simpliciteInstances.get(instanceUrl);
			if (!instance) throw new Error(instanceUrl + ' cannot be found in known instances url');
			if(!instance.app.authtoken) await this.setCredentials(instance.app);
			await instance.login();
			await this.applyLoginValues(instance);
			return true;
		} catch(e: any) {
			// delete token in persistance. Usefull when token is expired
			this.deleteToken(instanceUrl);
			logger.error(e.message ? e.message : e);
			return false;
		}
	}

	private async applyLoginValues(instance: SimpliciteInstance) {
		if(!this.devInfo) this.devInfo = await instance.getDevInfo();
		if (this.devInfo) await instance.setModulesDevInfo(this.devInfo);
		const authenticationValues: Array<{instanceUrl: string, authtoken: string}> = this._globalState.get(AUTHENTICATION_STORAGE) || [];
		const index = authenticationValues.findIndex((pair: {instanceUrl: string, authtoken: string}) => pair.instanceUrl === instance.app.url);
		if(index === -1) authenticationValues.push({instanceUrl: instance.app.parameters.url, authtoken: instance.app.authtoken});
		else authenticationValues[index].authtoken = instance.app.authtoken;
		this._globalState.update(AUTHENTICATION_STORAGE, authenticationValues);
	}

	private deleteToken(instanceUrl: string) {
		const authenticationValues: Array<{instanceUrl: string, authtoken: string}> = this._globalState.get(AUTHENTICATION_STORAGE) || [];
		const index = authenticationValues.findIndex((pair: {instanceUrl: string, authtoken: string}) => pair.instanceUrl === instanceUrl);
		//if(index === -1) return;
		authenticationValues.splice(index, 1);
		this._globalState.update(AUTHENTICATION_STORAGE, authenticationValues);
	}

	async logoutAll() {
		this.simpliciteInstances.forEach(async (instance: SimpliciteInstance, url: string) => {
			await this.logoutInstance(url);
		});
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

	// MODULES INITIALIZATION 

	async setSimpliciteInstancesFromWorkspace(): Promise<void> {
		const res = await this.getInstancesAndModulesFromWorkspace();
		for (const key of res.keys()) {
			if(!this.simpliciteInstances.has(key)) {
				const value = res.get(key);
				if(!value) continue;
				const instance = await SimpliciteInstance.build(value, key, this._globalState);
				this.simpliciteInstances.set(key, instance);
			}
		}
	}

	private async getInstancesAndModulesFromWorkspace(): Promise<Map<string, NameAndWorkspacePath[]>> {
		const list: Map<string, NameAndWorkspacePath[]> = new Map();
		for (const wk of workspace.workspaceFolders || []) {
			try {
				const name = wk.name;
				const re = new RegExp('^([A-Za-z0-9_-]+@[A-Za-z0-9-_\.]+)$');
				const folderName = re.exec(name);
				if(folderName) throw new Error(`Ignoring API Module ${folderName[0]} during module initialization`);
				const res: UrlAndName = await this.getModuleUrlAndNameFromWorkspace(wk);
				if(!list.has(res.instanceUrl)) list.set(res.instanceUrl, [{name: res.name, wkPath: wk.uri.path}]);
				else list.get(res.instanceUrl)?.push({name: res.name, wkPath: wk.uri.path});
			} catch(e) {
				logger.warn(e);
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

	// api module states : is it already in workspace (might not be if workspace folder is empty)
	public async initApiModule(instanceUrl: string, moduleName: string): Promise<void> {
		let instance = this.simpliciteInstances.get(instanceUrl);
		// associate to instance or create one
		if(!instance)	{
			instance = await SimpliciteInstance.build([], instanceUrl, this._globalState);
		}
		if(instance) {
			const apiModule = new ApiModule(moduleName, instanceUrl, instance.app, this._globalState);
			instance.modules.set(ApiModule.getApiModuleName(moduleName, instanceUrl), apiModule);
			// adding instance here, needs to be removed if process gets an error
			this.simpliciteInstances.set(instanceUrl, instance);
			const success = await this.loginInstance(instanceUrl);
			if(this.devInfo && success) {
				await apiModule.createProject(this.devInfo);
				//this.updateApiModuleState(apiModSave.instanceUrl, apiModSave.moduleName, true);
				const wkFolders = workspace.workspaceFolders ? workspace.workspaceFolders.length : 0;
				if(wkFolders === 0) {
					const ams: ApiModuleSave = { moduleName: moduleName, instanceUrl: instanceUrl };
					this._globalState.update(API_MODULE_ADDED_IN_EMPTY_WK, ams);
				} else {
					apiModule.saveAsToBeDeleted();
				}
				WorkspaceController.addWorkspaceFolder(apiModule.apiModuleName);
			} else {
				this.simpliciteInstances.delete(instanceUrl);
			}
		}
	}

	// VS Code restarts when one folder is added in an empty workspace
	// this method create the instance and module object instances
	private async setApiModuleAfterReset() {
		const emptyWk: ApiModuleSave | undefined = this._globalState.get(API_MODULE_ADDED_IN_EMPTY_WK);
		if(emptyWk) {
			const	instance = await SimpliciteInstance.build([], emptyWk.instanceUrl, this._globalState);
			if(instance) {
				const apiModule = new ApiModule(emptyWk.moduleName, emptyWk.instanceUrl, instance.app, this._globalState);
				instance.modules.set(ApiModule.getApiModuleName(emptyWk.moduleName, emptyWk.instanceUrl), apiModule);
				this.simpliciteInstances.set(emptyWk.instanceUrl, instance);
				await this.loginInstance(emptyWk.instanceUrl);
				apiModule.saveAsToBeDeleted();
			}
			this._globalState.update(API_MODULE_ADDED_IN_EMPTY_WK, undefined);
		}
	}

	// clear workspace from api modules on vs code start (cannot delete them on deactivate because of its unreliability https://code.visualstudio.com/api/get-started/extension-anatomy#extension-entry-file)
	private async clearExpiredApiModules() {
		const saved: ApiModuleSave[] = this._globalState.get(API_MODULES_TO_DELETE) || [];
		// reverse so we get a lifo. the last modules are more likely to not be the first folder in the worskpace. 
		// this gives the ability to remove the modules and their workspaces without potentialy reloading vs code multiple times which can be a (very) long process
		saved.slice().reverse().forEach(async (apiMS) => {
			if(WorkspaceController.isApiModuleInWorkspace(apiMS.moduleName, apiMS.instanceUrl)) WorkspaceController.removeApiFileSystemFromWorkspace(apiMS.moduleName, apiMS.instanceUrl);
			ApiModule.deleteFiles(apiMS.instanceUrl, apiMS.moduleName);
			this.removeExpiredPersistence(apiMS.moduleName, apiMS.instanceUrl);
		});
	}

	public deleteApiModule(moduleName: string, instanceUrl: string) {
		let instance = this.simpliciteInstances.get(instanceUrl);
		if(!instance) throw new Error('Cannot delete Api module, instance '+instanceUrl+' does not exist');
		const module = instance.modules.get(moduleName);
		if(!module || !(module instanceof ApiModule)) throw new Error('Cannot delete Api module, module '+moduleName+' does not exist, or is not an Api module');
		ApiModule.deleteFiles(instanceUrl, moduleName);
		instance.modules.delete(moduleName);
		this.removeExpiredPersistence(moduleName, instanceUrl);
	}

	private removeExpiredPersistence(moduleName: string, instanceUrl: string) {
		const saved: ApiModuleSave[] = this._globalState.get(API_MODULES_TO_DELETE) || [];
		const index = saved.findIndex((apiMS) => {
			apiMS.instanceUrl === instanceUrl && apiMS.moduleName === moduleName;
		})
		saved.splice(index, 1);
		this._globalState.update(API_MODULES_TO_DELETE, saved);
	}

	async removeModule(moduleName: string) {
		for (const key of this.simpliciteInstances.keys()) {
			const instance = this.simpliciteInstances.get(key)!;
			instance.deleteModule(moduleName);
			if(instance.modules.size === 0) {
				await instance.logout();
				this.simpliciteInstances.delete(key);
			}
		}
	}

	// FILES

	public getFileAndInstanceUrlFromPath(uri: Uri): FileInstance | undefined {
		for (const instance of this.simpliciteInstances.values()) {
			for (const m of instance.modules.values()) {
				const file = m.getFileFromPath(uri);
				if(file) return {file: file, url: instance.app.parameters.url};
			}
		}
		return undefined;
	}
 
	public async sendFiles(files: File[]) {
		files.forEach(async (file: File) => {
			await file.sendFile();
		});
	}

	public async sendAllFiles(): Promise<void> {
		const instanceUrls = this.simpliciteInstances.keys();
		for (const url of instanceUrls) {
			await this.sendInstanceFilesOnCommand(url);
		}
	}

	public async sendInstanceFilesOnCommand(url: string) {
		const instance = this.simpliciteInstances.get(url);
		if (!instance) throw new Error('Cannot send files. ' + url + ' is not a known instance');
		const statusFiles: File[] = instance.getTrackedFiles();
		await this.sendFiles(statusFiles);
		instance.triggerBackendCompilation(); // todo , implement already compiling backend queue
	}

	public async sendModuleFilesOnCommand(moduleName: string, instanceUrl: string) {
		const instance = this.simpliciteInstances.get(instanceUrl);
		if(!instance) throw new Error('Cannot send files. ' + instanceUrl + ' is not a known instance');
		const statusFiles = instance.getModuleTrackedFiles(moduleName);
		await this.sendFiles(statusFiles);
	}
}