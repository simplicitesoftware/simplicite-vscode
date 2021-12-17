'use strict';

import { Uri } from 'vscode';

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
		this.uri = Uri.parse(path);
		this.simpliciteUrl = simpliciteUrl;
		this.workspaceFolderPath = workspaceFolderPath;
		this.parentFolderName = parentFolderName;
		this.tracked = tracked;
		this.name = File.computeFileNameFromPath(path);
		this.extension = File.computeFileExtensionFromPath(path);
	}

	private setFileName(filePath: string): void {
		this.name = File.computeFileNameFromPath(filePath);
	}

	static computeFileNameFromPath(filePath: string): string {
		const decomposed = filePath.split('/');
		const decomposeDot = decomposed[decomposed.length - 1].split('.'); // remove extension
		return decomposeDot[decomposeDot.length - 2];
	}

	private setFileExtension(filePath: string) {
		this.extension = File.computeFileExtensionFromPath(filePath);
	}

	static computeFileExtensionFromPath(filePath: string) {
		const decomposed = filePath.split('.');
		const fileExtension = '.' + decomposed[decomposed.length - 1];
		return fileExtension;
	}
}