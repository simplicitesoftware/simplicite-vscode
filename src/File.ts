'use strict';

export class File {
	path: string;
	instanceUrl: string;
	workspaceFolderPath: string;
	parentFolderName: string;
	tracked: boolean;
	fileName: string;
	fileType: string | undefined;
	scriptField: string | undefined;
	properNameField: string | undefined;
	constructor(path: string, instanceUrl: string, workspaceFolderPath: string, parentFolderName: string, tracked: boolean) {
		this.path = path;
		this.instanceUrl = instanceUrl;
		this.workspaceFolderPath = workspaceFolderPath;
		this.parentFolderName = parentFolderName;
		this.tracked = tracked;
		this.fileName = this.fileNameFromPath(path);
		this.fileType = undefined;
		this.scriptField = undefined;
		this.properNameField = undefined;
	}

	private fileNameFromPath(filePath: string): string {
		const decomposed = filePath.split('/');
		const decomposeDot = decomposed[decomposed.length - 1].split('.'); // remove extension
		return decomposeDot[decomposeDot.length - 2];
	}
}