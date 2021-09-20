'use strict';

class Module {
    constructor (name, workspaceFolderName, workspaceFolderPath, instanceUrl, token) {
        this.name = name;
        this.workspaceFolderName = workspaceFolderName;
        this.workspaceFolderPath = workspaceFolderPath;
        this.instanceUrl = instanceUrl;
        this.token = token;
    }

    setName (name) {
        this.name = name;
    }
    getName () {
        return this.name;
    }

    setWorkspaceFolderName (workspaceFolderName) {
        this.workspaceFolderName = workspaceFolderName;
    }
    getWorkspaceFolderName () {
        return this.workspaceFolderName;
    }

    setWorkspaceFolderPath (workspaceFolderPath) {
        this.workspaceFolderPath = workspaceFolderPath; 
    }
    getWorkspaceFolderPath () {
        return this.workspaceFolderPath;
    }

    setInstanceUrl (instanceUrl) {
        this.instanceUrl = instanceUrl;
    }
    getInstanceUrl () {
        return this.instanceUrl;
    }

    setToken (token) {
        this.token = token;
    }
    getToken () {
        return this.token;
    }
}

module.exports = {
    Module: Module
}