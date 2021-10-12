'use strict';

import { crossPlatformPath } from "./utils";

export class File  {
    filePath: string;
    instanceUrl: string;
    workspaceFolderPath: string;
    moduleName: string;
    tracked: boolean;
    constructor (filePath: string, instanceUrl: string, workspaceFolderPath: string, moduleName: string, tracked: boolean) {
        this.filePath = crossPlatformPath(filePath);
        this.instanceUrl = instanceUrl;
        this.workspaceFolderPath = crossPlatformPath(workspaceFolderPath);
        this.moduleName = moduleName;
        this.tracked = tracked;
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