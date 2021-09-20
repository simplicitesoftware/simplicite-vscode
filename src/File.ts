'use strict';

class File  {
    constructor (filePath, instanceUrl, workspaceFolderPath) {
        this.filePath = filePath;
        this.instanceUrl = instanceUrl;
        this.workspaceFolderPath = workspaceFolderPath;
    }

    // SETTERS & GETTERS
    setFilePath (filePath) {
        this.filePath = filePath;
    }
    getFilePath () {
        return this.filePath;
    }

    setInstanceUrl (instanceUrl) {
        this.instanceUrl = instanceUrl;
    }
    getInstanceUrl () {
        return this.instanceUrl;
    }

    setWorkspaceFolderPath (workspaceFolderPath) {
        this.workspaceFolderPath = workspaceFolderPath;
    }
    getWorkspaceFolderPath () {
        return this.workspaceFolderPath;
    }

}

module.exports = {
    File: File
}