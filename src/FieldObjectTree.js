'use strict';

const { TreeDataProvider, TreeItemCollapsibleState, EventEmitter } = require('vscode');
const logger = require('./Log');

module.exports = class FieldObjectTree {
    constructor (request) {
        this.request = request;
        this._onDidChangeTreeData = new EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    
    async refresh() {
        this._onDidChangeTreeData.fire();
        this.request.fileHandler.setModules(await this.request.fileHandler.getSimpliciteModules()); 
    }

    fieldsIntoTreeItem (objectFieldInfo, element) {
        const fielditem = new Array();
        if (element === undefined) {
            for (let fieldLoop of objectFieldInfo) {
                fielditem.push(new TreeItem(fieldLoop.moduleName, TreeItemCollapsibleState.Collapsed));
            }
        } else if (element) {
            for (let fieldLoop of objectFieldInfo) {
                if (fieldLoop.moduleName === element) { // Nom des objets
                    for (let objF of fieldLoop.objectFields) {
                        fielditem.push(new TreeItem(objF.name, TreeItemCollapsibleState.Collapsed));
                    }
                } else {
                    for (let objF of fieldLoop.objectFields) {
                        if (objF.name === element) {
                            for (let field of objF.fields) {
                                fielditem.push(new TreeItem(field.name, TreeItemCollapsibleState.None));
                            }
                            
                        }
                    }
                }
            }
        }
        return fielditem;
    }

    async getFieldsOfAllModules (modules) {
        const fieldList = new Array();
        for (let module of modules) {
            fieldList.push({ objectFields: await this.request.getBusinessObjectFields(module.getInstanceUrl(), module.getName()), moduleName: module.getName() });
        }
        return fieldList;
    }

    getTreeItem (element) {
        return element;
    }

    async getChildren (element) {
        let label = undefined;
        if (element) label = element.label;
        try {
            const modules = this.request.moduleHandler.getModules();
            if (modules.length === 0) throw '';
            const objectFieldInfo = await this.getFieldsOfAllModules(modules);
            const fields = this.fieldsIntoTreeItem(objectFieldInfo, label);
            return Promise.resolve(fields);
        } catch (e) {
            logger.error(`${e}`);
            return Promise.resolve([]);
            //return Promise.reject(e);
        }   
    }

    
}

class TreeItem {
    constructor (label, collapsibleState) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}