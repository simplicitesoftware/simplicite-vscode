'use strict';

import { SimpliciteAPIManager } from "./SimpliciteAPIManager";
import { TreeItemCollapsibleState, EventEmitter, TreeItem, Event, TreeDataProvider, TreeItemLabel } from 'vscode';
import { logger } from './Log';
import { Module } from "./Module";
import * as path from 'path';

interface FieldInfo {
    moduleName: string;
    objectFields: Array<any>;
}

const objectFieldBind = [
    {
        objectType: 'BPMProcess',
        field: 'activities'
    },
    {
        objectType: 'ObjectExternal',
        field: 'actions'
    },
    {
        objectType: 'ObjectInternal',
        field: 'fields'
    }
];

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
        //
    }

    fieldsIntoTreeItem (objectFieldInfo: Array<FieldInfo>, element: any | TreeItem | ObjectItem | FieldItem | ObjectType) {
        let fieldItem = new Array();
        for (let moduleInfo of objectFieldInfo) {
            if (element === undefined) {
                fieldItem.push(this.getModuleItem(moduleInfo.moduleName));
            } else if (element instanceof ObjectType) {
                fieldItem = this.getObjectItems(moduleInfo, element.label);
            } else if (element.label === 'technical fields' && element instanceof FieldItem) {
                fieldItem = this.getTechnicalFieldsItems(moduleInfo, element);
            } else if (element instanceof ObjectItem) {
                fieldItem = this.getFieldsItems(moduleInfo, element);
            } else if (element instanceof TreeItem) { // module objects
                fieldItem = this.getObjectType(moduleInfo);
                //fieldItem = this.getObjectsItems(moduleInfo.moduleName);
            }
        }
        /*let fielditem = new Array();
         else if (element.label === 'technical fields' && element instanceof FieldItem) {
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
        }*/
        return fieldItem;
    }

    async getFieldsOfAllModules (modules: Array<Module>) {
        const fieldList = new Array();
        try {
            for (let module of modules) {
                fieldList.push({ objectFields: await this.request.getmoduleDevInfo(module.getInstanceUrl(), module.getName()), moduleName: module.getName() });
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

    private getObjectItems (moduleInfo: FieldInfo, label: string): Array<ObjectItem> {
        const objectItems = new Array();
        for (let objectType in moduleInfo.objectFields) {
            if (objectType === label) {
                for (let item of moduleInfo.objectFields[objectType]) {
                    objectItems.push(new ObjectItem(item.name, TreeItemCollapsibleState.Collapsed, moduleInfo.moduleName));
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

    private getTechnicalFieldsItems (moduleInfo: any, element: FieldItem): Array<TechnicalFieldItem>  {
        const technicalFields = new Array();
            for (let objF of moduleInfo.objectFields) {
                if (objF.name === element.objectMaster) {
                    for (let field of objF.fields) {
                        if (field.technical) {
                            technicalFields.push(new TechnicalFieldItem(field.name, TreeItemCollapsibleState.None, element.objectMaster, element.moduleMaster, field.column));
                        }
                    }
                }
            }    
        return technicalFields;
    }

    private getFieldsItems (moduleInfo: any, element: ObjectItem): Array<FieldItem> {
        const fielditem = new Array();
        for (let objectType in moduleInfo.objectFields) {
            if (objectType === element.label) {
                for (let item of moduleInfo.objectFields[objectType]) {
                    for (let field of item.fields) {
                        const treeItem = new FieldItem(field.name, TreeItemCollapsibleState.None, element.label, element.moduleName, field.column); 
                        treeItem.command = {
                            command: 'simplicite-vscode.fieldToClipBoard',
                            title: 'Not a title',
                            arguments: [field.name]
                        };
                        fielditem.push(treeItem);
                    }    
                    const technicalTreeItem = new FieldItem('technical fields', TreeItemCollapsibleState.Collapsed, element.label, element.moduleName, '');
                    fielditem.push(technicalTreeItem);  
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

    private getObjectFieldName (objectType: string) {
        
    }
}

class ObjectType extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly moduleName: string | TreeItemLabel,
      ) {
        super(label, collapsibleState);
        this.moduleName = moduleName; // depecrecated ?
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

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'object.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'object.svg')
    };
}



class FieldItem extends ObjectItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly objectMaster: string | TreeItemLabel,
        public readonly moduleMaster: string | TreeItemLabel,
        public description: string
    ) {
        super(label, collapsibleState, objectMaster);
        this.description = description;
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'field.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'field.svg')
    };
}

class TechnicalFieldItem extends FieldItem {
    technical: boolean;
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly objectMaster: string | TreeItemLabel,
        public readonly moduleMaster: string | TreeItemLabel, 
        public readonly description: string
    ) {
        super(label, collapsibleState, objectMaster, moduleMaster, description);
        this.technical = true;
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'field.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'field.svg')
    };
}