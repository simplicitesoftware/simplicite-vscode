'use strict';

import { Module } from './Module';
import { ApiModule } from './ApiModule';
import { NameAndWorkspacePath } from './interfaces';
import simplicite from 'simplicite';
import { Memento, window } from 'vscode';
import { logger } from './Log';
import { DevInfo } from './DevInfo';
import { File } from './File';

// represent a simplicite instance
export class SimpliciteInstance {
	modules: Map<string, Module>;
	apiModules: Map<string, ApiModule>;
	app: any;
	private _globalStorage: Memento;
	constructor(instanceUrl: string, globalStorage: Memento) {
		this.modules = new Map();
		this.apiModules = new Map();
		this.app = simplicite.session({ url: instanceUrl /*, debug: true*/ });
		this._globalStorage = globalStorage;
	}

	static async build(modulesName: NameAndWorkspacePath[], instanceUrl: string, globalStorage: Memento): Promise<SimpliciteInstance> {
		const simpliciteInstance = new SimpliciteInstance(instanceUrl, globalStorage);
		simpliciteInstance.setAuthtoken();
		await simpliciteInstance.initModules(modulesName);
		return simpliciteInstance
	}

	async initModules(modulesName: NameAndWorkspacePath[]): Promise<void> {
		const modules: Map<string, Module> = new Map();
		for (const value of modulesName) {
			if(!modules.has(value.name)) {
				const module = await Module.build(value.wkPath);
				modules.set(value.name, module);
			}
		}
		this.modules = modules;
	}

	private setAuthtoken() {
		const list: Array<{instanceUrl: string, authtoken: string}> = this._globalStorage.get(AUTHENTICATION_STORAGE) || [];
		list.forEach(a => {
			if(a.instanceUrl === this.app.parameters.url) this.app.authtoken = a.authtoken;
		});
	}

	async login(): Promise<void> {
		try {
			const res = await this.app.login();
			this.app.setPassword('');
			const msg  = 'Logged in as ' + res.login + ' at: ' + this.app.parameters.url;
			window.showInformationMessage('Simplicite: ' + msg);
			logger.info(msg);
		} catch (e: any) {
			this.app.setAuthToken('');
			window.showErrorMessage('Simplicite: ' + e.message ? e.message : e);
			throw new Error(e);
		}
	}

	async logout(): Promise<void> {
		try {
			await this.app.logout();
			const msg = 'Simplicite: Logged out from ' + this.app.parameters.url;
			window.showInformationMessage(msg);
			logger.info(msg);
		} catch (e: any) {
			logger.error(e);
			window.showErrorMessage('Simplicite: ' + e.message);
		}
	}

	async getDevInfo() {
		try {
			return new DevInfo(await this.app.getDevInfo());
		} catch(e) {
			logger.error(e);
		}
	}

	async sendFile(file: File) {
		const obj = this.app.getBusinessObject(file.type, 'ide_' + file.type);
		const item = await obj.getForUpdate(file.rowId, { inlineDocuments: true });
	}
}