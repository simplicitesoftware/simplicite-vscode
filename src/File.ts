'use strict';

import { Uri, workspace } from 'vscode';
import { DevInfo } from './DevInfo';
import { replaceAll } from './utils';

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
	rowId: number | undefined;
	extension: string;
	constructor(path: string, simpliciteUrl: string, workspaceFolderPath: string, parentFolderName: string, tracked: boolean) {
		this.uri = Uri.file(path);
		this.simpliciteUrl = simpliciteUrl;
		this.workspaceFolderPath = workspaceFolderPath;
		this.parentFolderName = parentFolderName;
		this.tracked = tracked;
		this.name = File.computeFileNameFromPath(path);
		this.extension = File.computeFileExtensionFromPath(path);
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

	// set mandatory values to send files on instance
	setApiFileInfo(devInfo: DevInfo | undefined): void {
		if (!this.type && !this.scriptField && !this.fieldName && devInfo) { // set the values only once
			this.type = this.getBusinessObjectType(devInfo);
			this.scriptField = this.getProperScriptField(devInfo);
			this.fieldName = this.getProperNameField(devInfo);
		}
	}

	private getBusinessObjectType(devInfo: DevInfo): string {
		for (const object of devInfo.objects) {
			if (object.package) {
				const comparePackage = replaceAll(object.package, /\./, '/');
				if (this.uri.path.includes(comparePackage)) {
					return object.object;
				}
			}
		}
		if (this.uri.path.includes('/resources/')) { // handling manually packages that are not in devInfo
			return 'Resource';
		} else if (this.uri.path.includes('/test/src/com/simplicite/')) {
			return 'Script';
		} else if (this.uri.path.includes('/scripts/')) {
			return 'Disposition';
		} else {
			throw new Error('No type has been found');
		}
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