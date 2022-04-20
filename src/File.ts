'use strict';

import { Uri, workspace } from 'vscode';
import { DevInfo } from './DevInfo';

export class File {
	uri: Uri;
	tracked: boolean;
	name: string;
	type: string | undefined;
	scriptField: string | undefined;
	fieldName: string | undefined;
	rowId: string | undefined;
	extension: string;
	constructor(uri: Uri, tracked: boolean) {
		this.uri = uri
		this.tracked = tracked;
		this.name = File.computeFileNameFromPath(uri.path);
		this.extension = File.computeFileExtensionFromPath(uri.path); // format ex: ".java"
	}


	// todo , check for URI
	static computeFileNameFromPath(filePath: string): string {
		const decomposed = filePath.split('/');
		const decomposeDot = decomposed[decomposed.length - 1].split('.'); // remove extension
		return decomposeDot[decomposeDot.length - 2];
	}

	static computeFileExtensionFromPath(filePath: string): string {
		const decomposed = filePath.split('.');
		const fileExtension = '.' + decomposed[decomposed.length - 1];
		return fileExtension;
	}

	setModuleDevInfo(moduleDevInfo: any, devInfo: DevInfo) {
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
				if (!devInfoObject.sourcepath) continue;
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
		return content;
	}
}