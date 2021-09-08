'use strict';

class ModuleHandler {
    constructor () {
        this.modules = new Array();
    }

    setModules (modules) {
        this.modules = modules;
    }
    getModules () {
        return this.modules;
    }

    moduleLength () {
        return this.modules.length;
    }

    spreadToken (instanceUrl, token) {
        for (let module of this.modules) {
            if (module.getInstanceUrl() === instanceUrl) {
                module.setToken(token);
            }
        }
    }

    getDisconnectedModules () { // useful ?
        const disconnectedModules = new Array();
        for (let module of this.modules) {
            if (!module.getToken()) disconnectedModules.push(module);
        }
        return disconnectedModules;
    }

    getConnectedInstancesUrl () {
        const connectedInstances = new Array();
        for (let module of this.modules) {
            if (module.getToken()) connectedInstances.push(module.getInstanceUrl());
        }
        return connectedInstances;
    }

    getModuleUrlFromName (moduleName) {
        for (let module of this.modules) {
            if (module.getName() === moduleName) {
                return module.getInstanceUrl();
            }
        }
    }
}

module.exports = {
    ModuleHandler: ModuleHandler
}