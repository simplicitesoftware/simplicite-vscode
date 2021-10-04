'use strict';

import { SimpliciteAPIManager } from "./SimpliciteAPIManager";
import { TreeItemCollapsibleState, EventEmitter, TreeItem, Event, TreeDataProvider, TreeItemLabel, Uri } from 'vscode';
import { logger } from './Log';
import { Module } from "./Module";
import { objectInfo } from './constant';
import * as path from 'path';

interface FieldInfo {
    moduleName: string;
    objectFields: Array<any>;
}

interface ObjectInfo {
    objectType: string,
    field: string,
    icons: {dark: string | Uri, light: string | Uri},
    fieldIcons: {dark: string | Uri, light: string | Uri}
};

export class FieldObjectTree implements TreeDataProvider<TreeItem> {
    request: SimpliciteAPIManager;
    private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void>;
    readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void>;
    private modules: Array<Module>;
    private objectFieldInfoCache: Array<any> | undefined;
    constructor (request: SimpliciteAPIManager) {
        this.request = request;
        this.modules = request.moduleHandler.getModules();
        this._onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.objectFieldInfoCache = undefined;
    }

    async refresh() {
        this.setModules(await this.request.fileHandler.getSimpliciteModules()); 
        this._onDidChangeTreeData.fire();
    }

    fieldsIntoTreeItem (objectFieldInfo: Array<FieldInfo>, element: any | TreeItem | ObjectItem | FieldItem | ObjectType) {
        let fieldItem = new Array();
        for (let moduleInfo of objectFieldInfo) {
            if (element === undefined) {
                fieldItem = fieldItem.concat(this.getModuleItem(moduleInfo.moduleName));
            } else if (element.technical && element instanceof FieldItem && element.moduleName === moduleInfo.moduleName) {
                const objectInfo = this.getObjectFieldNameAndIcon(element.objectInfo.objectType);
                if (objectInfo) {
                    fieldItem = fieldItem.concat(this.getTechnicalFieldsItems(moduleInfo, element, objectInfo));
                }
                break;
            } else if (element instanceof ObjectItem && element.moduleName === moduleInfo.moduleName) {
                const objectInfo = this.getObjectFieldNameAndIcon(element.objectInfo.objectType);
                if (objectInfo) {
                    fieldItem = fieldItem.concat(this.getFieldsItems(moduleInfo, element, objectInfo));
                }
                break;
            } else if (element instanceof ObjectType && element.moduleName === moduleInfo.moduleName) {
                const objectInfo = this.getObjectFieldNameAndIcon(element.label);
                if (objectInfo) {
                    fieldItem = fieldItem.concat(this.getObjectItems(moduleInfo, element.label, objectInfo));
                } 
                break;
            } else if (element instanceof TreeItem && element.label === moduleInfo.moduleName) { // module objects
                fieldItem = fieldItem.concat(this.getObjectType(moduleInfo));
                break;
            }
        }
        return fieldItem;
    }

    async getFieldsOfAllModules (modules: Array<Module>) {
        const fieldList = new Array();
        try {
            for (let module of modules) {
                if (this.request.moduleHandler.getConnectedInstancesUrl().includes(module.getInstanceUrl())) {
                    fieldList.push({ objectFields: await this.request.getmoduleDevInfo(module.getInstanceUrl(), module.getName()), moduleName: module.getName() });
                }
            }
            return fieldList;
        } catch (e) {
            logger.error(e);
            throw new Error('No fieldList, cannot getChildren in Tree View');
        }
        
    }

    getTreeItem (element: TreeItem | ObjectItem | FieldItem | ObjectType): TreeItem | ObjectItem | FieldItem | ObjectType {
        if (element instanceof FieldItem && element.label !== 'technical fields') {
            element.contextValue = 'field';
        } else if (element.label === 'technical fields') {
            element.contextValue = 'treeItem';
        } else if (element instanceof ObjectItem) {
            element.contextValue = 'object';
        } else {
            element.contextValue = 'treeItem';
        }
        return element;
    }

    async getChildren (element: TreeItem | ObjectItem | FieldItem | ObjectType): Promise<Array<TreeItem | ObjectItem | FieldItem | ObjectType>> {
        let label = undefined;
        let objectFieldInfo = new Array();
        if (element) {
            label = element.label;
        }
        try {
            if (this.modules.length === 0) {
                throw new Error('');
            }
            try {
                objectFieldInfo = await this.getFieldsOfAllModules(this.modules);
                this.objectFieldInfoCache = objectFieldInfo;
            } catch (e) {
                if (!this.objectFieldInfoCache) {
                    logger.info('getFieldOFAllModules failed, using cache');
                } else {
                    throw new Error('Cannot provide items, make sure you are connected');
                }
            }
            
            if (objectFieldInfo.length === 0) {
                throw new Error('Cannot provide items, make sure you are connected');
            }
            const fields = this.fieldsIntoTreeItem(objectFieldInfo, element);
            return Promise.resolve(fields);
        } catch (e: any) {
            logger.error(`${e}`);
            return Promise.resolve([new TreeItem(e.message, TreeItemCollapsibleState.None)]);
        }
    }
    private setModules (modules: Array<Module>) {
        this.modules = modules;
    }

    private getObjectItems (moduleInfo: FieldInfo, label: string, objectInfo: ObjectInfo): Array<ObjectItem> {
        const objectItems = new Array();
        for (let objectType in moduleInfo.objectFields) {
            if (objectType === label) {
                for (let item of moduleInfo.objectFields[objectType]) {
                    let collapsibleState: TreeItemCollapsibleState;
                    if (objectInfo.field === '' || item[objectInfo.field] === undefined && label !== 'Script' && label !== 'Adapter' || label === 'Disposition') {
                        collapsibleState = TreeItemCollapsibleState.None;
                    } else {
                        collapsibleState = TreeItemCollapsibleState.Collapsed;
                    }
                    objectItems.push(new ObjectItem(item.name, collapsibleState, moduleInfo.moduleName, objectInfo, item.table));
                }
            } else {
                continue;
            }
        }
        return objectItems;
    }

    private getModuleItem (moduleName: string): TreeItem {
        const treeItem = new TreeItem(moduleName, TreeItemCollapsibleState.Collapsed);
        treeItem.iconPath = {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'module.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'module.svg')
        };
        return treeItem;
    }

    private getTechnicalFieldsItems (moduleInfo: any, element: FieldItem, objectInfo: ObjectInfo): Array<FieldItem>  {
        const technicalFields = new Array();
        const objectInternal = moduleInfo.objectFields['ObjectInternal'];
        for (let objF of objectInternal) {
            if (objF.name === element.masterObject) {
                for (let field of objF.fields) {
                    if (field.technical) {
                        technicalFields.push(new FieldItem(field.name, TreeItemCollapsibleState.None, moduleInfo.moduleName, objectInfo, field.column, true, element.masterObject));
                    }
                }
            }
        }    
        return technicalFields;
    }

    private getFieldsItems (moduleInfo: FieldInfo, element: ObjectItem, objectInfo: ObjectInfo): Array<FieldItem> {
        const fielditem = new Array();
        if (element.objectInfo.field !== '') {
            for (let objectType in moduleInfo.objectFields) {
                if (objectType === element.objectInfo.objectType) {
                    for (let item of moduleInfo.objectFields[objectType]) {
                        if (item.name === element.label) {
                            let hasTechnicalField = false;
                            for (let field of item[element.objectInfo.field]) {
                                if (field.technical !== undefined) {
                                    if (field.technical) {
                                        hasTechnicalField = true;
                                    }
                                }
                                const treeItem = new FieldItem(field.name, TreeItemCollapsibleState.None, moduleInfo.moduleName, objectInfo, field.column, true, element.label); 
                                treeItem.command = {
                                    command: 'simplicite-vscode.fieldToClipBoard',
                                    title: 'Not a title',
                                    arguments: [field.name]
                                };
                                fielditem.push(treeItem);
                            }
                            if (hasTechnicalField) {
                                const technicalTreeItem = new FieldItem('technical fields', TreeItemCollapsibleState.Collapsed, moduleInfo.moduleName, element.objectInfo , '', true, element.label);
                                fielditem.push(technicalTreeItem);
                            }
                        }
                    }
                }
            }
        }
        return fielditem;
    }

    private getObjectType(moduleInfo: FieldInfo): Array<ObjectItem> {
        const objectItems = new Array();
        for (let objectType in moduleInfo.objectFields) {
            if (objectType === 'Adapter' 
            || objectType === 'BPMProcess' 
            || objectType === 'Disposition' 
            || objectType === 'ObjectExternal' 
            || objectType === 'ObjectInternal' 
            || objectType === 'Script') 
            {
                if (moduleInfo.objectFields[objectType].length !== 0) {

                    objectItems.push(new ObjectType(objectType, TreeItemCollapsibleState.Collapsed, moduleInfo.moduleName));
                }
            }
        }
        return objectItems;
    }

    private getObjectFieldNameAndIcon (objectType: string): ObjectInfo | undefined {
        for (let type of objectInfo) {
            if (type.objectType === objectType) {
                return type;
            }
        }
        return;
    }
}



class ObjectType extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly moduleName: string | TreeItemLabel,
      ) {
        super(label, collapsibleState);
        this.moduleName = moduleName;
    }
}

class ObjectItem extends ObjectType {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly moduleName: string | TreeItemLabel,
        public readonly objectInfo: ObjectInfo,
        public readonly description: string
      ) {
        super(label, collapsibleState, moduleName);
        this.objectInfo = objectInfo;
        this.iconPath = objectInfo.icons;
        this.description = description;
    }
}



class FieldItem extends ObjectItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly moduleName: string | TreeItemLabel,
        public readonly objectInfo: ObjectInfo,
        public readonly description: string,
        public readonly technical: boolean,
        public readonly masterObject: string
    ) {
        super(label, collapsibleState, moduleName, objectInfo, description);
        this.technical = technical;
        this.masterObject = masterObject;
    }
}