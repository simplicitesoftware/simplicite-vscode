'use strict';

import { Uri, workspace } from 'vscode';
import { DevInfo } from './DevInfo';

export class File {
	uri: Uri;
	simpliciteUrl: string;
	workspaceFolderPath: string;
	parentFolderName: string;
	tracked: boolean;
	name: string;
	type: string | undefined;
	scriptField: string | undefined;
	fieldName: string | undefined;
	rowId: string | undefined;
	extension: string;
	constructor(path: string, simpliciteUrl: string, workspaceFolderPath: string, parentFolderName: string, tracked: boolean) {
		this.uri = Uri.file(path);
		this.simpliciteUrl = simpliciteUrl;
		this.workspaceFolderPath = workspaceFolderPath;
		this.parentFolderName = parentFolderName;
		this.tracked = tracked;
		this.name = File.computeFileNameFromPath(path);
		this.extension = File.computeFileExtensionFromPath(path); // format ex: ".java"
	}

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

	static tempPathMaker(file: File) {
		return STORAGE_PATH + 'temp/' + file.parentFolderName + '/' + file.name + file.extension;
	}
}