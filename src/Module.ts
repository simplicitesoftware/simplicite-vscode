'use strict';

export class Module {
    name: string;
    workspaceFolderPath: string;
    instanceUrl: string;
    token: string | null;
    moduleDevInfo: any;
    constructor (name: string, workspaceFolderPath: string, instanceUrl: string, token: string) {
        this.name = name;
        this.workspaceFolderPath = workspaceFolderPath;
        this.instanceUrl = instanceUrl;
        this.token = token;
        this.moduleDevInfo = undefined;
    }
}