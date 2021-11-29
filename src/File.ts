'use strict';

export class File {
	filePath: string;
	instanceUrl: string;
	workspaceFolderPath: string;
	moduleName: string;
	tracked: boolean;
	constructor(filePath: string, instanceUrl: string, workspaceFolderPath: string, moduleName: string, tracked: boolean) {
		this.filePath = filePath;
		this.instanceUrl = instanceUrl;
		this.workspaceFolderPath = workspaceFolderPath;
		this.moduleName = moduleName;
		this.tracked = tracked;
	}
}