/* eslint-disable @typescript-eslint/no-non-null-assertion */
'use strict';

import { RelativePattern, window } from 'vscode';
import { AppHandler } from './AppHandler';
import { File } from './File';
import { logger } from './Log';
import { Buffer } from 'buffer';
import { DevInfo } from './DevInfo';

export class SimpliciteApi {
	devInfo?: DevInfo;


	

	// async fetchDevInfo(instanceUrl: string): Promise<DevInfo> {
	// 	const app = this._appHandler.getApp(instanceUrl);
	// 	const devInfo = new DevInfo(await app.getDevInfo());
	// 	return devInfo;
	// }

	// async fetchModuleInfo(instanceUrl: string, moduleName: string): Promise<any> {
	// 	const app = this._appHandler.getApp(instanceUrl);
	// 	const moduleDevInfo = await app.getDevInfo(moduleName);
	// 	return moduleDevInfo;
	// }

	// async writeFile(file: File): Promise<boolean> {
	// 	const obj = this.appAndBusinessObject(file);
	// 	const item = await this.searchForUpdate(file, obj);
	// 	const doc = obj.getFieldDocument(file.scriptField);
	// 	if (doc === undefined) {
	// 		throw new Error('No document returned, cannot update content');
	// 	}
	// 	// get the file content for setContent
	// 	try {
	// 		const content = await File.getContent(file.uri);
	// 		doc.setContentFromText(content);
	// 		obj.setFieldValue(file.scriptField, doc);
	// 		const res = await obj.update(item, { inlineDocuments: true });
	// 		if (!res) {
	// 			window.showErrorMessage('Simplicite: Cannot synchronize ' + file.uri.path);
	// 			return false;
	// 		}
	// 	} catch(e) {
	// 		logger.error(e);
	// 		return false;
	// 	}
	// 	return true;
	// }

	// private async searchForUpdate(file: File, obj: any): Promise<any> {
	// 	const item = await obj.getForUpdate(file.rowId, { inlineDocuments: true });
	// 	return item;
	// }

	// async getRemoteFileContent (file: File): Promise<Uint8Array | undefined> {
	// 	const obj = this.appAndBusinessObject(file);
	// 	const res = await obj.get(file.rowId, { inlineDocuments: [ true ] });
	// 	const content = res[file.scriptField!].content;
	// 	if (!content) {
	// 		return undefined;
	// 	}
	// 	const buff = Buffer.from(content, 'base64');
	// 	return buff;
	// }

	// private appAndBusinessObject(file: File): any {
	// 	const app = this._appHandler.getApp(file.simpliciteUrl);
	// 	const obj = app.getBusinessObject(file.type, 'ide_' + file.type);
	// 	return obj;
	// }
}

