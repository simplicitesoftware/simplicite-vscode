/* eslint-disable @typescript-eslint/no-non-null-assertion */
'use strict';

import { window } from 'vscode';
import { AppHandler } from './AppHandler';
import { File } from './File';
import { logger } from './Log';
import { Buffer } from 'buffer';
import { DevInfo } from './DevInfo';
import { Credentials } from './interfaces';

export class SimpliciteApi {
	_appHandler: AppHandler;
	devInfo?: DevInfo;
	constructor(appHandler: AppHandler) {
		this._appHandler = appHandler;
	}

	async login(instanceUrl: string, credentials: Credentials | undefined, token: string | undefined): Promise<string | false> {
		const app = this._appHandler.getApp(instanceUrl);
		if (credentials) {
			app.setPassword(credentials.password);
			app.setUsername(credentials.userName);
		} else if (token !== '') {
			app.authtoken = token;
		} else if (!credentials && token === '') {
			return false;
		}
		try {
			const res = await app.login();
			app.setPassword(undefined);
			app.setUsername(undefined);
			if (!this.devInfo) {
				this.devInfo = await this.fetchDevInfo(instanceUrl);
			}
			const message = 'Logged in as ' + res.login + ' at: ' + app.parameters.url;
			window.showInformationMessage('Simplicite: ' + message);
			logger.info(message);
			return res.authtoken;
		} catch (e: any) {
			logger.error(e);
			window.showErrorMessage('Simplicite: ' + e.message ? e.message : e);
			return false;
		}
	}

	async logout(instanceUrl: string): Promise<boolean> {
		const app = this._appHandler.getApp(instanceUrl);
		try {
			await app.logout();
			window.showInformationMessage('Simplicite: Logged out from ' + instanceUrl);
			return true;
		} catch (e: any) {
			window.showErrorMessage('Simplicite: ' + e.message);
			logger.error(e);
			return false;
		}
	}

	async fetchDevInfo(instanceUrl: string): Promise<DevInfo> {
		const app = this._appHandler.getApp(instanceUrl);
		const devInfo = new DevInfo(await app.getDevInfo());
		return devInfo;
	}

	async fetchModuleInfo(instanceUrl: string, moduleName: string): Promise<any> {
		const app = this._appHandler.getApp(instanceUrl);
		const moduleDevInfo = await app.getDevInfo(moduleName);
		return moduleDevInfo;
	}

	async writeFile(file: File): Promise<boolean> {
		const obj = this.appAndBusinessObject(file);
		const item = await this.searchForUpdate(file, obj);
		const doc = obj.getFieldDocument(file.scriptField);
		if (doc === undefined) {
			throw new Error('No document returned, cannot update content');
		}
		// get the file content for setContent
		try {
			const content = await File.getContent(file.uri);
			doc.setContentFromText(content);
			obj.setFieldValue(file.scriptField, doc);
			const res = await obj.update(item, { inlineDocuments: true });
			if (!res) {
				window.showErrorMessage('Simplicite: Cannot synchronize ' + file.uri.path);
				return false;
			}
		} catch(e) {
			logger.error(e);
			return false;
		}
		return true;
	}

	private async searchForUpdate(file: File, obj: any): Promise<any> {
		const item = await obj.getForUpdate(file.rowId, { inlineDocuments: true });
		return item;
	}

	async getRemoteFileContent (file: File): Promise<Uint8Array | undefined> {
		const obj = this.appAndBusinessObject(file);
		const res = await obj.get(file.rowId, { inlineDocuments: [ true ] });
		const content = res[file.scriptField!].content;
		if (!content) {
			return undefined;
		}
		const buff = Buffer.from(content, 'base64');
		return buff;
	}

	private appAndBusinessObject(file: File): any {
		const app = this._appHandler.getApp(file.simpliciteUrl);
		const obj = app.getBusinessObject(file.type, 'ide_' + file.type);
		return obj;
	}
}

