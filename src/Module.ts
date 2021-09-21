'use strict';

export class Module {
    name: string;
    workspaceFolderName: string;
    workspaceFolderPath: string;
    instanceUrl: string;
    token: string | null;
    constructor (name: string, workspaceFolderName: string, workspaceFolderPath: string, instanceUrl: string, token: string) {
        this.name = name;
        this.workspaceFolderName = workspaceFolderName;
        this.workspaceFolderPath = workspaceFolderPath;
        this.instanceUrl = instanceUrl;
        this.token = token;
    }

    setName (name: string) {
        this.name = name;
    }
    getName () {
        return this.name;
    }

    setWorkspaceFolderName (workspaceFolderName: string) {
        this.workspaceFolderName = workspaceFolderName;
    }
    getWorkspaceFolderName () {
        return this.workspaceFolderName;
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