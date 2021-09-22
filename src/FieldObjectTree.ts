'use strict';

import { SimpliciteAPIManager } from "./SimpliciteAPIManager";
import { TreeItemCollapsibleState, EventEmitter, TreeItem, Event, TreeDataProvider } from 'vscode';
import { logger } from './Log';
import { Module } from "./Module";

interface FieldInfo {
    moduleName: string;
    objectFields: Array<any>;
}

export class FieldObjectTree implements TreeDataProvider<CustomItem> {
    request: SimpliciteAPIManager;
    _onDidChangeTreeData: EventEmitter<CustomItem>;
    onDidChangeTreeData: Event<CustomItem>;
    constructor (request: SimpliciteAPIManager) {
        this.request = request;
        this._onDidChangeTreeData = new EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    
    async refresh() {
        this.request.moduleHandler.setModules(await this.request.fileHandler.getSimpliciteModules()); 
        this._onDidChangeTreeData.fire(new CustomItem('test', TreeItemCollapsibleState.None));
    }

    fieldsIntoTreeItem (objectFieldInfo: Array<FieldInfo>, element?: string) {
        const fielditem = new Array();
        if (element === undefined) {
            for (let fieldLoop of objectFieldInfo) {
                fielditem.push(new TreeItem(fieldLoop.moduleName, TreeItemCollapsibleState.Collapsed));
            }
        } else if (element) {
            let elseFlag = true;
            for (let fieldLoop of objectFieldInfo) {
                if (fieldLoop.moduleName === element) { // Nom des objets
                    elseFlag = false;
                    for (let objF of fieldLoop.objectFields) {
                        fielditem.push(new TreeItem(objF.name, TreeItemCollapsibleState.Collapsed));
                    }
                } else if (elseFlag) {
                    for (let objF of fieldLoop.objectFields) {
                        if (objF.name === element) {
                            for (let field of objF.fields) {
                                const treeItem = new TreeItem(field.name, TreeItemCollapsibleState.None); 
                                treeItem.command = {
                                    command: 'simplicite-vscode.fieldToClipBoard',
                                    title: 'Not a title',
                                    arguments: [field.name]
                                }
                                fielditem.push(treeItem);
                            }
                            
                        }
                    }
                }
            }
        }
        return fielditem;
    }

    async getFieldsOfAllModules (modules: Array<Module>) {
        const fieldList = new Array();
        for (let module of modules) {
            fieldList.push({ objectFields: await this.request.getBusinessObjectFields(module.getInstanceUrl(), module.getName()), moduleName: module.getName() });
        }
        return fieldList;
    }

    getTreeItem (element: CustomItem): CustomItem {
        return element;
    }

    async getChildren (element: CustomItem): Promise<Array<CustomItem>> {
        let label = undefined;
        if (element) {
            label = element.label;
        }
        try {
            const modules = this.request.moduleHandler.getModules();
            if (modules.length === 0) {
                throw '';
            }
            const objectFieldInfo = await this.getFieldsOfAllModules(modules);
            const fields = this.fieldsIntoTreeItem(objectFieldInfo, label);
            return Promise.resolve(fields);
        } catch (e) {
            logger.error(`${e}`);
            return Promise.resolve([new CustomItem('Log in to get the object fields', TreeItemCollapsibleState.None)]);
        }   
    }    
}

class CustomItem extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState
      ) {
        super(label, collapsibleState);
      }
}
