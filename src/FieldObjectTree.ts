'use strict';

import { SimpliciteAPIManager } from "./SimpliciteAPIManager";
import { TreeItemCollapsibleState, EventEmitter, TreeItem, Event, TreeDataProvider, TreeItemLabel } from 'vscode';
import { logger } from './Log';
import { Module } from "./Module";

interface FieldInfo {
    moduleName: string;
    objectFields: Array<any>;
}

export class FieldObjectTree implements TreeDataProvider<TreeItem> {
    request: SimpliciteAPIManager;
    private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void>;
    readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void>;
    private modules: Array<Module>;
    constructor (request: SimpliciteAPIManager) {
        this.request = request;
        this.modules = request.moduleHandler.getModules();
        this._onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    async refresh() {
        this.setModules(await this.request.fileHandler.getSimpliciteModules()); 
        this._onDidChangeTreeData.fire();
        //
    }

    fieldsIntoTreeItem (objectFieldInfo: Array<FieldInfo>, element: any | TreeItem | ObjectItem | FieldItem) {
        let fielditem = new Array();
        if (element === undefined) {
            for (let fieldLoop of objectFieldInfo) {
                fielditem.push(new TreeItem(fieldLoop.moduleName, TreeItemCollapsibleState.Collapsed));
            }
        } else if (element.label === 'technical fields' && element instanceof FieldItem) {
            fielditem = this.getTechnicalFields(objectFieldInfo, element);
        } else if (element instanceof ObjectItem) {
            fielditem = this.getFields(objectFieldInfo, element);
        } else if (element instanceof TreeItem) { // module objects
            for (let fieldLoop of objectFieldInfo) {
                if (fieldLoop.moduleName === element.label) { // Nom des objets
                    for (let objF of fieldLoop.objectFields) {
                        fielditem.push(new ObjectItem(objF.name, TreeItemCollapsibleState.Collapsed, fieldLoop.moduleName));
                    }
                }
            }
        }
        return fielditem;
    }

    async getFieldsOfAllModules (modules: Array<Module>) {
        const fieldList = new Array();
        try {
            for (let module of modules) {
                fieldList.push({ objectFields: await this.request.getBusinessObjectFields(module.getInstanceUrl(), module.getName()), moduleName: module.getName() });
            }
            return fieldList;
        } catch (e) {
            logger.error(e);
            throw new Error('No fieldList, cannot getChildren in Tree View');
        }
        
    }

    getTreeItem (element: TreeItem | ObjectItem | FieldItem): TreeItem | ObjectItem | FieldItem {
        return element;
    }

    async getChildren (element: TreeItem | ObjectItem | FieldItem): Promise<Array<TreeItem | ObjectItem | FieldItem>> {
        let label = undefined;
        if (element) {
            label = element.label;
        }
        try {
            if (this.modules.length === 0) {
                throw new Error('');
            }
            const objectFieldInfo = await this.getFieldsOfAllModules(this.modules);
            if (objectFieldInfo.length === 0) {
                throw new Error('objectFieldInfo is not defined. ' + this.request.moduleHandler.getConnectedInstancesUrl().length + ' modules are connected');
            }
            const fields = this.fieldsIntoTreeItem(objectFieldInfo, element);
            return Promise.resolve(fields);
        } catch (e) {
            logger.error(`${e}`);
            return Promise.resolve([new TreeItem('Log in to get the object fields', TreeItemCollapsibleState.None)]);
        }   
    }
    private setModules (modules: Array<Module>) {
        this.modules = modules;
    }

    private getTechnicalFields (objectFieldInfo: Array<FieldInfo>, element: FieldItem): Array<TechnicalFieldItem>  {
        const technicalFields = new Array();
        for (let fieldLoop of objectFieldInfo) {
            if (fieldLoop.moduleName === element.moduleMaster) {
                for (let objF of fieldLoop.objectFields) {
                    if (objF.name === element.objectMaster) {
                        for (let field of objF.fields) {
                            if (field.technical) {
                                technicalFields.push(new TechnicalFieldItem(field.name, TreeItemCollapsibleState.None, element.objectMaster, element.moduleMaster));
                            }
                        }
                    }
                }    
            }
        }
        return technicalFields;
    }

    private getFields (objectFieldInfo: Array<FieldInfo>, element: ObjectItem): Array<FieldItem> {
        const fielditem = new Array();
        for (let fieldLoop of objectFieldInfo) {
            for (let objF of fieldLoop.objectFields) {
                if (objF.name === element.label) {
                    for (let field of objF.fields) {
                        if (element instanceof ObjectItem && !field.technical) {
                            const treeItem = new FieldItem(field.name, TreeItemCollapsibleState.None, element.label, element.moduleName); 
                            treeItem.command = {
                                command: 'simplicite-vscode.fieldToClipBoard',
                                title: 'Not a title',
                                arguments: [field.name]
                            };
                            fielditem.push(treeItem);
                        }
                    }
                    if(element instanceof ObjectItem) {
                        const technicalTreeItem = new FieldItem('technical fields', TreeItemCollapsibleState.Collapsed, element.label, element.moduleName);
                        fielditem.push(technicalTreeItem);
                    }  
                }
            }    
        }
        return fielditem;
    }
}

class ObjectItem extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly moduleName: string | TreeItemLabel,
      ) {
        super(label, collapsibleState);
        this.moduleName = moduleName;
      }
}
 

class FieldItem extends ObjectItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly objectMaster: string | TreeItemLabel,
        public readonly moduleMaster: string | TreeItemLabel,
    ) {
        super(label, collapsibleState, objectMaster);
    }
}

class TechnicalFieldItem extends FieldItem {
    technical: boolean;
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly objectMaster: string | TreeItemLabel,
        public readonly moduleMaster: string | TreeItemLabel, 
    ) {
        super(label, collapsibleState, objectMaster, moduleMaster);
        this.technical = true;
    }
}