'use strict';

export class Module {
<<<<<<< HEAD
    name: string;
    workspaceFolderName: string;
    workspaceFolderPath: string;
    instanceUrl: string;
    token: string | null;
    constructor (name: string, workspaceFolderName: string, workspaceFolderPath: string, instanceUrl: string, token: string) {
=======
    constructor (name, workspaceFolderName, workspaceFolderPath, instanceUrl, token) {
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
        this.name = name;
        this.workspaceFolderName = workspaceFolderName;
        this.workspaceFolderPath = workspaceFolderPath;
        this.instanceUrl = instanceUrl;
        this.token = token;
    }

<<<<<<< HEAD
    setName (name: string) {
=======
    setName (name) {
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
        this.name = name;
    }
    getName () {
        return this.name;
    }

<<<<<<< HEAD
    setWorkspaceFolderName (workspaceFolderName: string) {
=======
    setWorkspaceFolderName (workspaceFolderName) {
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
        this.workspaceFolderName = workspaceFolderName;
    }
    getWorkspaceFolderName () {
        return this.workspaceFolderName;
    }

<<<<<<< HEAD
    setWorkspaceFolderPath (workspaceFolderPath: string) {
=======
    setWorkspaceFolderPath (workspaceFolderPath) {
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
        this.workspaceFolderPath = workspaceFolderPath; 
    }
    getWorkspaceFolderPath () {
        return this.workspaceFolderPath;
    }

<<<<<<< HEAD
    setInstanceUrl (instanceUrl: string) {
=======
    setInstanceUrl (instanceUrl) {
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
        this.instanceUrl = instanceUrl;
    }
    getInstanceUrl () {
        return this.instanceUrl;
    }

<<<<<<< HEAD
    setToken (token: string | null) {
=======
    setToken (token) {
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
        this.token = token;
    }
    getToken () {
        return this.token;
    }
}