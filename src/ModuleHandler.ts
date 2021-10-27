'use strict';

import { logger } from "./Log";
import { Module } from "./Module";
import { ModuleInfoTree } from "./treeView/ModuleInfoTree";
import { crossPlatformPath } from "./utils";

export class ModuleHandler {
    modules: Array<Module>;
    connectedInstancesUrl: Array<string>;
    moduleInfoTree: ModuleInfoTree | undefined;
    constructor () {
        this.connectedInstancesUrl = new Array();
        this.modules = new Array();
        this.moduleInfoTree = undefined;
    }

    setModuleInfoTree (moduleInfoTree: ModuleInfoTree) {
        this.moduleInfoTree = moduleInfoTree;
        this.refreshTreeView(undefined);
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

    setModules (modules: Array<Module>, refresh: boolean) {
        this.modules = modules;
        if (refresh) {
            this.refreshTreeView(modules);
        }
    }

    moduleLength () {
        return this.modules.length;
    }

    spreadToken (instanceUrl: string, token: string | null) {
        for (let module of this.modules) {
            if (module.instanceUrl === instanceUrl) {
                module.token = token;
            }
        }
    }

    getDisconnectedModules () { // useful ?
        const disconnectedModules = new Array();
        for (let module of this.modules) {
            if (!module.token) {
                disconnectedModules.push(module);
            }
        }
        return disconnectedModules;
    }

    getModuleUrlFromName (moduleName: string): string {
        for (let module of this.modules) {
            if (module.name === moduleName) {
                return module.instanceUrl;
            }
        }
        logger.error('Cannot get module url from name');
        return '';
    }

    getModuleFromName (moduleName: string): Module | undefined {
        for (let module of this.modules) {
            if (module.name === moduleName) {
                return module;
            }
        }
        return undefined;
    }

    getModuleUrlFromWorkspacePath (workspacePath: string): string {
        try {
            for (let module of this.modules) {
                if (module.workspaceFolderPath === crossPlatformPath(workspacePath)) {
                    return module.instanceUrl;
                }
            }
        } catch (e) {
            logger.error(e);
        }
        return '';
    }

    removeConnectedInstancesUrl (instanceUrl: string) {
        const index = this.connectedInstancesUrl.indexOf(instanceUrl);
        this.connectedInstancesUrl.splice(index, 1);
    }

    getAllModuleDevInfo (): Array<any> {
        const returnValue = new Array();
        for (let module of this.modules) {
            returnValue.push(module.moduleDevInfo);
        }
        return returnValue;
    }

    refreshTreeView (modules: Module[] | undefined) {
        if (this.moduleInfoTree) {
            if (modules) {
                this.moduleInfoTree.setModules(modules); // refresh the moduleInfo tree view
            } else {
                this.moduleInfoTree.setModules(this.modules);            }
        }
    }
}