'use strict';

import { commands, Memento, Uri, window, workspace } from 'vscode';
import { DevInfo } from './DevInfo';
import { HashService } from './HashService';
const buffer = require('buffer/').Buffer;

export class CustomFile {
	uri: Uri;
	name: string;
	type: string | undefined;
	scriptField: string | undefined;
	fieldName: string | undefined;
	extension: string;
	rowId: string;
	private _app: any;
	private _globalState: Memento;
	constructor(uri: Uri, app: any, globalState: Memento) {
		this.uri = uri;
		this.name = CustomFile.computeFileNameFromPath(uri.path);
		this.extension = CustomFile.computeFileExtensionFromPath(uri.path); // format ex: ".java"
		this._app = app;
		this._globalState = globalState;
		this.rowId = '';
	}

	// todo , check for URI
	static computeFileNameFromPath(filePath: string): string {
		const decomposed = filePath.split('/');
		const decomposeDot = decomposed[decomposed.length - 1].split('.');
		return decomposeDot[decomposeDot.length - 2];
	}

	static computeFileExtensionFromPath(filePath: string): string {
		const decomposed = filePath.split('.');
		const fileExtension = '.' + decomposed[decomposed.length - 1];
		return fileExtension;
	}

	setInfoFromModuleDevInfo(moduleDevInfo: any, devInfo: DevInfo) {
		if (!this.type && !this.scriptField && !this.fieldName) {
			const {type, id} = this.getBusinessObjectInfo(moduleDevInfo);
			this.type = type;
			this.rowId = id;
			this.scriptField = this.getProperScriptField(devInfo);
			this.fieldName = this.getProperNameField(devInfo);
		}
	}

	private getBusinessObjectInfo(moduleDevInfo: any): {type: string, id: string} {
		for (const type in moduleDevInfo) {
			for(const devInfoObject of moduleDevInfo[type]) {
				if (!devInfoObject.sourcepath) continue; // no sourcepath == no code file associated
				if (this.uri.path.includes(devInfoObject.sourcepath)) return {type: type, id: devInfoObject.id};
			}
		}
		return {type: '', id: ''};
	}

	private getProperScriptField(devInfo: DevInfo) {
		for (const object of devInfo.objects) {
			if (this.type === object.object) {
				return object.sourcefield;
			}
		}
	}

	private getProperNameField(devInfo: DevInfo) {
		for (const object of devInfo.objects) {
			if (this.type === object.object) {
				return object.keyfield;
			}
		}
	}

	static async getContent(fileUri: Uri): Promise<Uint8Array> {
		const content = await workspace.fs.readFile(fileUri);
		return buffer.from(content, 'base64');
	}

	public async getRemoteFileContent (): Promise<Uint8Array | undefined> {
		const obj = await this._app.getBusinessObject(this.type, 'ide_' + this.type);
		await obj.get(this.rowId, { inlineDocuments: [ true ] });
		const doc = obj.getFieldDocument(this.scriptField);

		if (!doc.content) {
			return undefined;
		}
		return buffer.from(doc.content, 'base64');
	}

	public async sendFile(instance: string, module: string) {
		try {
			const obj = await this._app.getBusinessObject(this.type, 'ide_' + this.type);

			const item = await obj.getForUpdate(this.rowId, { inlineDocuments: true });
			const doc = obj.getFieldDocument(this.scriptField);
			if (doc === undefined) throw new Error('No document returned, cannot update content');
			
			const content = await CustomFile.getContent(this.uri);
			doc.setContentFromText(content);
			obj.setFieldValue(this.scriptField, doc);
			const res = await obj.update(null, { inlineDocuments: true });
			const lowerPath = this.uri.path.toLowerCase();
			await this._globalState.update(lowerPath, undefined);
			if (!res) {
				const msg = this.uri.path;
				console.error('Simplicite: Cannot synchronize ' + msg);
				window.showErrorMessage(msg);
			}
			console.log(`${this.name} has been successfully applied`);
		} catch(e: any) {
			window.showErrorMessage(e.message);
			console.error(e.message);
		}
		await HashService.updateFileHash(instance, module, this.uri, this._globalState);
	}

	public async saveFileAsTracked() {
		const lowerPath = this.uri.path.toLowerCase();
		await this._globalState.update(lowerPath, true);
		await commands.executeCommand('simplicite-vscode-tools.refreshFileHandler');
	}

	public getTrackedStatus() {
		const lowerPath = this.uri.path.toLowerCase();
		return this._globalState.get(lowerPath) ? true : false;
	}
}