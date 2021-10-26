'use strict';

export class Module {
    private name: string;
    private workspaceFolderPath: string;
    private instanceUrl: string;
    private token: string | null;
    moduleDevInfo: any;
    constructor (name: string, workspaceFolderPath: string, instanceUrl: string, token: string) {
        this.name = name;
        this.workspaceFolderPath = workspaceFolderPath;
        this.instanceUrl = instanceUrl;
        this.token = token;
        this.moduleDevInfo = undefined;
    }

    setName (name: string) {
        this.name = name;
    }
    getName () {
        return this.name;
    }

    setWorkspaceFolderPath (workspaceFolderPath: string) {
        this.workspaceFolderPath = workspaceFolderPath; 
    }
    getWorkspaceFolderPath () {
        return this.workspaceFolderPath;
    }

    setInstanceUrl (instanceUrl: string) {
        this.instanceUrl = instanceUrl;
    }
    getInstanceUrl () {
        return this.instanceUrl;
    }

    setToken (token: string | null) {
        this.token = token;
    }
    getToken () {
        return this.token;
    }
}