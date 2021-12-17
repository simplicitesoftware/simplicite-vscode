/* eslint-disable @typescript-eslint/no-non-null-assertion */
'use strict';

import { window } from 'vscode';
import { AppHandler } from './AppHandler';
import { File } from './File';
import { Credentials } from './interfaces';
import { logger } from './Log';
import { replaceAll } from './utils';
import { Module } from './Module';
import { Cache } from './Cache';
import { Buffer } from 'buffer';
import { FileHandler } from './FileHandler';

export class SimpliciteApi {
	_appHandler: AppHandler;
	_cache: Cache;	
	_conflictStatus: boolean;
	devInfo: any;
	constructor(appHandler: AppHandler) {
		this._appHandler = appHandler;
		this._conflictStatus = false;
		this._cache = new Cache(); 
	}

	async login(instanceUrl: string, credentials: Credentials | undefined, token: string): Promise<string | false> {
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
			if (!this.devInfo) {
				this.devInfo = await this.fetchDevOrModuleInfo(instanceUrl, undefined);
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

	async logout (instanceUrl: string): Promise<boolean> {
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

	async fetchDevOrModuleInfo (instanceUrl: string, moduleName: string | undefined): Promise<any> {
		const app = this._appHandler.getApp(instanceUrl);
		try {
			if (moduleName) {
				const moduleDevInfo = await app.getDevInfo(moduleName);
				return moduleDevInfo;
			} else {
				const devInfo = await app.getDevInfo();
				return devInfo;
			}
			
		} catch (e) {
			logger.error(e);
			return undefined;
		}
	}

	async writeFile(file: File): Promise<boolean> {
		file.setApiFileInfo(this.devInfo);
		const app = this._appHandler.getApp(file.simpliciteUrl);
		const obj = await app.getBusinessObject(file.type, 'ide_' + file.type);
		const item = await this.searchForUpdate(file, obj);
		const doc = obj.getFieldDocument(file.scriptField);
		if (doc === undefined) {
			throw new Error('No document returned, cannot update content');
		}
		// get the file content for setContent
		const content = await File.getContent(file.uri);
		doc.setContentFromText(content);
		obj.setFieldValue(file.scriptField, doc);
		const res = await obj.update(item, { inlineDocuments: true });
		if (!res) {
			window.showErrorMessage('Simplicite: Cannot synchronize ' + file.uri.path);
			return false;
		}
		return true;
	}

	async searchForUpdate(file: File, obj: any): Promise<any> { // todo return, just return rowId with cache
		if (!file.rowId) {
			const list = await this.search(file.simpliciteUrl, file.fieldName!, file.name);
			if (list.length === 0) {
				throw new Error('No object has been returned');
			}
			let objectFound = list[0];
			if (file.type === 'Resource') {
				for (const object of list) {
					if (object.res_object.userkeylabel === getResourceFileName(file.uri.path)) {
						objectFound = object;
					}
				}
			}
			file.rowId = objectFound.row_id;
		}
		const item = await obj.getForUpdate(file.rowId, { inlineDocuments: true });
		return item;
	}

	getRemoteFileContent () { // todo

	}

	

	async search (simpliciteUrl: string, fieldName: string, fieldContent: string | number): Promise<any> { // generic search function
		const app = this._appHandler.getApp(simpliciteUrl);
		const res = await app.search({ [fieldName!]: fieldContent });
		return res;
	}
}

function getResourceFileName(filePath: string): string {
	const decomposed = filePath.split('/');
	return decomposed[decomposed.length - 2];
}

