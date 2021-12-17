'use strict';

import { Uri, workspace } from 'vscode';
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
	extension: string | undefined;
	constructor(path: string, simpliciteUrl: string, workspaceFolderPath: string, parentFolderName: string, tracked: boolean) {
		this.uri = Uri.parse('file://' + path, true);
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

	setApiFileInfo(devInfo: any): void {
		if (!this.type && !this.scriptField && !this.fieldName) { // set the values only once
			this.type = this.getBusinessObjectType(devInfo);
			this.scriptField = this.getProperScriptField(devInfo);
			this.fieldName = this.getProperNameField(devInfo);
		}
	}

	private getBusinessObjectType(devInfo: any): string {
		for (const object of devInfo.objects) {
			if (object.package) {
				const comparePackage = replaceAll(object.package, /\./, '/');
				if (this.uri.path.includes(comparePackage)) {
					return object.object;
				}
			}
		}
		if (this.uri.path.includes('/resources/')) { // programatically handling packages that are not in devInfo
			return 'Resource';
		} else if (this.uri.path.includes('/test/src/com/simplicite/')) {
			return 'Script';
		} else if (this.uri.path.includes('/scripts/')) {
			return 'Disposition';
		} else {
			throw new Error('No type has been found');
		}
	}

	private getProperScriptField(devInfo: any) {
		for (const object of devInfo.objects) {
			if (this.type === object.object) {
				return object.sourcefield;
			}
		}
	}

	private getProperNameField(devInfo: any) {
		for (const object of devInfo.objects) {
			if (this.uri.path === object.object) {
				return object.keyfield;
			}
		}
	}

	static async getContent(fileUri: Uri): Promise<Uint8Array> { // todo
		const content = await workspace.fs.readFile(fileUri);
		//const fileContent = FileHandler.getContentFromModuleFile(fileContentList, module); // usefull if same module is in workspace as Api file system (written on disk) AND as module
		//const document = await workspace.openTextDocument(fileContent);
		//const text = document.getText();
		return content;
	}
}