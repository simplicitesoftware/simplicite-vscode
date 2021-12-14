/* eslint-disable @typescript-eslint/no-non-null-assertion */
'use strict';

import { window, workspace, Uri, commands, ExtensionContext } from 'vscode';
import { AppHandler } from './AppHandler';
import { File } from './File';
import { Credentials } from './interfaces';
import { logger } from './Log';
import { replaceAll } from './utils';
import { Module } from './Module';
import { Cache } from './Cache';
import { Buffer } from 'buffer';

export class SimpliciteApi {
	_appHandler: AppHandler;
	_conflictStatus: boolean;
	_cache: Cache;
	_extensionStoragePath: Uri;
	constructor(appHandler: AppHandler, storageUri: Uri) {
		this._appHandler = appHandler;
		this._conflictStatus = false;
		this._cache = new Cache();
		this._extensionStoragePath = storageUri; 
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

	async writeFile(file: File, devInfo: any, module: Module): Promise<boolean> {
		if (!file.type && !file.scriptField && !file.properNameField) { // set the values only once
			file.type = this.getBusinessObjectType(file.path, devInfo); 	
			file.scriptField = this.getProperScriptField(file.type, devInfo);
			file.properNameField = this.getProperNameField(file.type, devInfo);
		}
		const app = this._appHandler.getApp(file.simpliciteUrl);
		const obj = await app.getBusinessObject(file.type, 'ide_' + file.type);
		const item = await this.searchForUpdate(file.name, obj, file.properNameField!, file.type!, file.path);
		const workingFileContent = await workspace.fs.readFile(Uri.parse(file.path));
		const fileExtension = this.getFileExtension(file.path);
		
		if (module.apiFileSystem) {
			await this.conflictChecker(workingFileContent, file, fileExtension, item, file.scriptField!);
		}
		
		const doc = obj.getFieldDocument(file.scriptField);
		if (doc === undefined) {
			throw new Error('No document returned, cannot update content');
		}
		
		// get the file content for setContent
		const find = '**/src/**/' + file.name + fileExtension;
		const fileContentList = await workspace.findFiles(find);
		const fileContent = this.getContentFromModuleFile(fileContentList, module);
		const document = await workspace.openTextDocument(fileContent); // to do
		const text = document.getText();
		doc.setContentFromText(text);
		obj.setFieldValue(file.scriptField, doc);
		const res = await obj.update(item, { inlineDocuments: true });
		if (!res) {
			window.showErrorMessage('Simplicite: Cannot synchronize ' + file.path);
			return false;
		}
		
		// once the object is updated, write the content in the temp files so all the files share the same state (workingFileContent, localInitialFileContent & remoteFileContent) 
		if (module.apiFileSystem) {
			await workspace.fs.writeFile(Uri.parse(this._extensionStoragePath + '/' + file.parentFolderName + '/temp/' + file.name + fileExtension), workingFileContent);
			const uri = Uri.parse(this._extensionStoragePath + '/' + file.parentFolderName + '/temp/RemoteFile.java');
			try {
				await workspace.fs.delete(uri);
			} catch (e) {
				logger.error(this._extensionStoragePath + '/' + file.parentFolderName + '/temp/RemoteFile.java' + ' does not exist (no conflict)');
			}
			this._conflictStatus = false;
		}
		return true;
	}

	async searchForUpdate(fileName: string, obj: any, properNameField: string, fileType: string, filePath: string): Promise<any> { // todo return, just return rowId with cache
		if (!this._cache.isInCache(fileName)) {
			const list = await obj.search({ [properNameField]: fileName });
			if (list.length === 0) {
				throw new Error('No object has been returned');
			}
			let objectFound = list[0];
			if (fileType === 'Resource') {
				for (const object of list) {
					if (object.res_object.userkeylabel === getResourceFileName(filePath)) {
						objectFound = object;
					}
				}
			}
			this._cache.addPair(fileName, objectFound.row_id);
		}
		const rowId = this._cache.getListFromCache(fileName);
		const item = await obj.getForUpdate(rowId, { inlineDocuments: true });
		return item;
	}

	private getProperNameField(fileType: string, devInfo: any) {
		if (!devInfo) {
			return;
		}
		for (const object of devInfo.objects) {
			if (fileType === object.object) {
				return object.keyfield;
			}
		}
	}

	private getProperScriptField(fileType: string, devInfo: any) {
		if (!devInfo) {
			return;
		}
		for (const object of devInfo.objects) {
			if (fileType === object.object) {
				return object.sourcefield;
			}
		}
	}

	private getBusinessObjectType(filePath: string, devInfo: any): string {
		if (!devInfo) {
			throw new Error('devInfo is undefined, make sure that you have the right to access this module');
		}
		for (const object of devInfo.objects) {
			if (object.package) {
				const comparePackage = replaceAll(object.package, /\./, '/');
				if (filePath.includes(comparePackage)) {
					return object.object;
				}
			}
		}
		if (filePath.includes('/resources/')) { // programatically handling packages that are not in devInfo
			return 'Resource';
		} else if (filePath.includes('/test/src/com/simplicite/')) {
			return 'Script';
		} else if (filePath.includes('/scripts/')) {
			return 'Disposition';
		} else {
			throw new Error('No type has been found');
		}
	}

	async conflictChecker (workingFileContent: Uint8Array, file: File, fileExtension: string, item: any, fieldScriptId: string): Promise<void> {
		try {
			if (this._conflictStatus) {
				return;
			}
			const initialFilePath = Uri.parse(this._extensionStoragePath + '/' + file.parentFolderName + '/temp/' + file.name + fileExtension);
			const localInitialFileContent =  await workspace.fs.readFile(initialFilePath); 
			const remoteFileContent = Buffer.from(item[fieldScriptId].content, 'base64');
			// check if the local initial state of the file is the same as the remote file
			const isRemoteEqualToInitial = Buffer.compare(remoteFileContent, localInitialFileContent);
			const isWorkingEqualToInitial = Buffer.compare(workingFileContent, localInitialFileContent);
			if (isRemoteEqualToInitial !== 0 && isWorkingEqualToInitial !== 0) {
				const remoteFilePath = Uri.parse(this._extensionStoragePath + '/' + file.parentFolderName + '/temp/RemoteFile.java');
				this._conflictStatus = true;
				// need to write the file in order to get the file content in vscode.diff
				await workspace.fs.writeFile(remoteFilePath, Buffer.from(item[fieldScriptId].content, 'base64'));
				await commands.executeCommand('vscode.diff', Uri.parse(file.path), remoteFilePath);
				window.showWarningMessage('Simplicite: Conflict detected with remote file, edit the file on the left panel and save to apply the modifications. If you do not want to merge the two versions, you can overwrite the content of the file of your choice by clicking on the following button and choose between these two actions: \'Remote\' to overwrite the local content with the remote content & \'Local\' to overwrite the remote content with the local content. Note that the modifications on the overwritten file will be lost', 'Choose action').then(async (click) => {
					if (click === 'Choose action') {
						const choice = await window.showQuickPick([{ label: 'Remote' }, { label: 'Local' }]);
						if (!choice) {
							const msg = 'No file has been chosen';
							window.showInformationMessage('Simplicite: ' + msg);
							throw new Error(msg);
						} else if (choice.label === 'Remote') { // just write content on local file
							await workspace.fs.writeFile(Uri.parse(file.path), Buffer.from(item[fieldScriptId].content, 'base64'));
							await workspace.fs.writeFile(initialFilePath, item[fieldScriptId].content);
							await workspace.fs.delete(remoteFilePath);
							this._conflictStatus = false;
						} else if (choice.label === 'Local') {
							// to do
							//await this.writeFile(file, devInfo, module);
						}
					}
				});
				throw new Error('Conflict');
			} else if (isWorkingEqualToInitial === 0 && isRemoteEqualToInitial !== 0) {
				// if no local changes and remote changed, update local files
				await workspace.fs.writeFile(Uri.parse(file.path), Buffer.from(item[fieldScriptId].content, 'base64'));
				await workspace.fs.writeFile(initialFilePath, Buffer.from(item[fieldScriptId].content, 'base64'));
				window.showInformationMessage('Simplicite: Local file content hasn\'t changed. Fetched latest remote file content');
				throw new Error('No local changes on save, remote file was changed --> fetched file content to local');
			} else if (isRemoteEqualToInitial === 0 && isWorkingEqualToInitial === 0) {
				throw new Error('No changes');
			}
		} catch (e: any) {
			throw new Error(e);
		}
	}

	search (instanceUrl: string, fieldName: string, fieldContent: string): unknown {
		const app = this._appHandler.getApp(instanceUrl);
		const res = app.search({ [fieldName]: fieldContent });
		return res;
	}

	private getContentFromModuleFile (fileContentList: any, module: Module): any { // to do
		if (!fileContentList) {
			return undefined;
		}
		for (const file of fileContentList) {
			if (file.path.includes('Api_') && module.apiFileSystem) {
				return file;
			} else if (file.path.includes(module.name) && !file.path.includes('Api_') && !module.apiFileSystem) {
				return file;
			}
		}
	}

	private getFileExtension (filePath: string) {
		const decomposed = filePath.split('.');
		const fileExtension = '.' + decomposed[decomposed.length - 1];
		return fileExtension;
	}
}

function getResourceFileName(filePath: string): string {
	const decomposed = filePath.split('/');
	return decomposed[decomposed.length - 2];
}

