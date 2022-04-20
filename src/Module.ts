'use strict';

export class Module {
	// remove name as it should be in map
	moduleDevInfo: any;
	workspaceFolderPath: string;
	constructor(workspaceFolderPath: string) {
		this.moduleDevInfo = undefined;
		this.workspaceFolderPath = workspaceFolderPath;
	}
}