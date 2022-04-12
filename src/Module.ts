'use strict';

export class Module {
	name: string;
	instanceUrl: string;
	token: string;
	moduleDevInfo: any;
	connected: boolean;
	//parentFolderName: string;
	workspaceFolderPath: string;
	constructor(name: string, workspaceFolderPath: string, instanceUrl: string, token: string) {
		this.name = name;
		this.instanceUrl = instanceUrl;
		this.token = token;
		this.moduleDevInfo = undefined;
		this.connected = false;
		//this.parentFolderName = Module.computeParentFolderName(workspaceFolderPath); // check
		this.workspaceFolderPath = workspaceFolderPath;
	}

	// static computeParentFolderName (folderPath: string) {
	// 	const decomposedPath = folderPath.split('/');
	// 	const index = decomposedPath.length - 1;
	// 	return decomposedPath[index];
	// }
}