'use strict';

export class Module {
	name: string;
	workspaceFolderPath: string;
	instanceUrl: string;
	token: string;
	moduleDevInfo: any;
	apiFileSystem: boolean;
	instanceJump: boolean; // usefull to get api module in construction
	connected: boolean;
	parentFolderName: string;
	constructor(name: string, workspaceFolderPath: string, instanceUrl: string, token: string, apiFileSystem: boolean, instanceJump: boolean) {
		this.name = name;
		this.workspaceFolderPath = workspaceFolderPath;
		this.instanceUrl = instanceUrl;
		this.token = token;
		this.moduleDevInfo = undefined;
		this.apiFileSystem = apiFileSystem;
		this.instanceJump = instanceJump;
		this.connected = false;
		this.parentFolderName = Module.computeParentFolderName(workspaceFolderPath);
	}

	static computeParentFolderName (folderPath: string) {
		const decomposedPath = folderPath.split('/');
		const index = decomposedPath.length - 1;
		return decomposedPath[index];
	}
}