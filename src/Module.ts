'use strict';

export class Module {
	name: string;
	instanceUrl: string;
	token: string;
	moduleDevInfo: any;
	connected: boolean;
	workspaceFolderPath: string;
	constructor(name: string, workspaceFolderPath: string, instanceUrl: string, token: string) {
		this.name = name;
		this.instanceUrl = instanceUrl;
		this.token = token;
		this.moduleDevInfo = undefined;
		this.connected = false;
		this.workspaceFolderPath = workspaceFolderPath;
	}
}