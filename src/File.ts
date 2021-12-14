'use strict';

export class File {
	path: string;
	simpliciteUrl: string;
	workspaceFolderPath: string;
	parentFolderName: string;
	tracked: boolean;
	name: string;
	type: string | undefined;
	scriptField: string | undefined;
	properNameField: string | undefined;
	constructor(path: string, simpliciteUrl: string, workspaceFolderPath: string, parentFolderName: string, tracked: boolean) {
		this.path = path;
		this.simpliciteUrl = simpliciteUrl;
		this.workspaceFolderPath = workspaceFolderPath;
		this.parentFolderName = parentFolderName;
		this.tracked = tracked;
		this.name = this.fileNameFromPath(path);
		this.type = undefined;
		this.scriptField = undefined;
		this.properNameField = undefined;
	}

	private fileNameFromPath(filePath: string): string {
		const decomposed = filePath.split('/');
		const decomposeDot = decomposed[decomposed.length - 1].split('.'); // remove extension
		return decomposeDot[decomposeDot.length - 2];
	}
}