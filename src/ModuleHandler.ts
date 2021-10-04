'use strict';

import { logger } from "./Log";
import { Module } from "./Module";

export class ModuleHandler {
    modules: Array<Module>;
    private connectedInstancesUrl: Array<string>;
    constructor () {
        this.connectedInstancesUrl = new Array();
        this.modules = new Array();
    }

    addInstanceUrl (instanceUrl: string) {
        if (!this.connectedInstancesUrl.includes(instanceUrl)) {
            this.connectedInstancesUrl.push(instanceUrl);
        }
    }

    removeInstanceUrl (instanceUrl: string) {
        const index = this.connectedInstancesUrl.indexOf(instanceUrl);
        this.connectedInstancesUrl.splice(index, 1);
    }

    setModules (modules: Array<Module>) {
        this.modules = modules;
    }
    getModules () {
        return this.modules;
    }

    moduleLength () {
        return this.modules.length;
    }

    spreadToken (instanceUrl: string, token: string | null) {
        for (let module of this.modules) {
            if (module.getInstanceUrl() === instanceUrl) {
                module.setToken(token);
            }
        }
    }

    getDisconnectedModules () { // useful ?
        const disconnectedModules = new Array();
        for (let module of this.modules) {
            if (!module.getToken()) {
                disconnectedModules.push(module);
            }
        }
        return disconnectedModules;
    }

    getConnectedInstancesUrl (): Array<string> {
        return this.connectedInstancesUrl;
    }

    getModuleUrlFromName (moduleName: string): string {
        for (let module of this.modules) {
            if (module.getName() === moduleName) {
                return module.getInstanceUrl();
            }
        }
        logger.error('Cannot get module url from name');
        return '';
    }

    getModuleNameFromUrl (instanceUrl: string): string {
        for (let module of this.modules) {
            if (module.getInstanceUrl() === instanceUrl) {
                return module.getName();
            }
        }
        logger.error('Cannot get module name from url');
        return '';
    }

    getModuleUrlFromWorkspacePath (workspacePath: string) {
        try {
            for (let module of this.modules) {
                if (module.getWorkspaceFolderPath() === workspacePath) {
                    return module.getInstanceUrl();
                }
            }
        } catch (e) {
            logger.error(e);
        }
        
    }
}