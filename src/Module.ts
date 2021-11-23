'use strict';

export class Module {
	name: string;
	workspaceFolderPath: string;
	instanceUrl: string;
	token: string | null;
	moduleDevInfo: any;
	remoteFileSystem: boolean;
	constructor(name: string, workspaceFolderPath: string, instanceUrl: string, token: string, remoteFileSystem: boolean) {
		this.name = name;
		this.workspaceFolderPath = workspaceFolderPath;
		this.instanceUrl = instanceUrl;
		this.token = token;
		this.moduleDevInfo = undefined;
		this.remoteFileSystem = remoteFileSystem;
	}
}