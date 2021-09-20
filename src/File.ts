'use strict';

export class File  {
    filePath: string;
    instanceUrl: string;
    workspaceFolderPath: string;

    constructor (filePath: string, instanceUrl: string, workspaceFolderPath: string) {
        this.filePath = filePath;
        this.instanceUrl = instanceUrl;
        this.workspaceFolderPath = workspaceFolderPath;
    }

    // SETTERS & GETTERS
    setFilePath (filePath: string) {
        this.filePath = filePath;
    }
    getFilePath () {
        return this.filePath;
    }

    setInstanceUrl (instanceUrl: string) {
        this.instanceUrl = instanceUrl;
    }
    getInstanceUrl () {
        return this.instanceUrl;
    }

    setWorkspaceFolderPath (workspaceFolderPath: string) {
        this.workspaceFolderPath = workspaceFolderPath;
    }
    getWorkspaceFolderPath () {
        return this.workspaceFolderPath;
    }
}