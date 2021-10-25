'use strict';

import { TreeItemCollapsibleState, TreeItemLabel, EventEmitter, TreeItem, Event, TreeDataProvider, window } from 'vscode';
import { Module } from "../Module";
import * as path from 'path';
import { DevInfoObject } from '../interfaces';

// Object Info tree view
export class ModuleInfoTree implements TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void>;
    readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void>;
    private _modules: Array<Module> | undefined;
    private _devInfo: any;
    constructor (modules: Module[] | undefined, devInfo: any) {
        this._onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._modules = modules;
        this._devInfo = devInfo;
    }

    private async refresh() {
        this._onDidChangeTreeData.fire();
    }

    setModules (modules: Array<Module>) {
        this._modules = modules;
        this.refresh();
    }

    getTreeItem (element: CustomTreeItem | TreeItem): CustomTreeItem | TreeItem {
        if (element instanceof CustomTreeItem) {
            if (element.objectType === ItemType.module) {
                element.contextValue = 'label&description';
            } else if (element.objectType === ItemType.objectType) {
                element.contextValue = 'label';
            } else if (element.objectType === ItemType.object) {
                if (element.description === '') {
                    element.contextValue = 'label';
                } else {
                    element.contextValue = 'label&description';
                }
            } else if (element.objectType === ItemType.attribute) {
                if (element.collapsibleState === TreeItemCollapsibleState.Collapsed) {
                    return element;
                } else if (!element.additionalInfo && element.description) {
                    element.contextValue = 'label&description';
                } else if (!element.additionalInfo && element.description === '') {
                    element.contextValue = 'label';
                } else {
                    element.contextValue = 'label&description&jsonName';
                }
            } else if (element.objectType === ItemType.technical) {
                element.contextValue = 'label&description&jsonName';
            }
        }
        return element;
    }

    async getChildren (element: CustomTreeItem): Promise<TreeItem[]> {
        if (element === undefined) {
            return Promise.resolve(this.getModulesItems());
        } else if (element.objectType === ItemType.module) {
            return Promise.resolve(this.getObjectTypesItems(element.itemInfo));
        } else if (element.objectType === ItemType.objectType) {
            if (typeof element.label !== 'string') {
                return Promise.resolve([]);
            }
            return Promise.resolve(this.getObjectItems(element.itemInfo, this.getObjectDevInfo(element.label)));
        } else if (element.objectType === ItemType.object) {
            return Promise.resolve(this.getAttributeItems(element.itemInfo));
        } else if (element.objectType === ItemType.technicalRoot) {
            return Promise.resolve(this.getTechnicalFieldsItems(element.itemInfo));
        } 
        return  Promise.resolve([]);
    }

    private getModulesItems (): CustomTreeItem[] {
        if (!this._modules) {
            return [];
        }
        const modulesItems = new Array();
        for (let module of this._modules) {
            modulesItems.push(new CustomTreeItem(module.getName(), TreeItemCollapsibleState.Collapsed, module.getInstanceUrl(), ItemType.module, module, 'module', undefined));
        }
        return modulesItems;
    }

    private getObjectTypesItems (module: Module): TreeItem[] {
        const moduleDevInfo = module.moduleDevInfo;
        if (!moduleDevInfo) {
            return [new TreeItem('Nothing to display', TreeItemCollapsibleState.None)];
        }
        const objectTypesItems = new Array();
        for (let type in moduleDevInfo) {
            if (type === 'name' || type === 'version' || moduleDevInfo[type].length === 0) {
                continue;
            }
            objectTypesItems.push(new CustomTreeItem(type, TreeItemCollapsibleState.Collapsed, '', ItemType.objectType, moduleDevInfo[type], '', undefined));
        }
        return objectTypesItems;
    }

    private getObjectItems (objects: any, devInfoObject: DevInfoObject | void): TreeItem[] {
        if (!objects || !devInfoObject) {
            return [];
        }
        const objectItems = new Array();
        for (let object of objects) {
            let collapsibleState = TreeItemCollapsibleState.None;
            if (devInfoObject.completion !== undefined) {
                collapsibleState = TreeItemCollapsibleState.Collapsed;
            }
            objectItems.push(new CustomTreeItem(object.name, collapsibleState, object.table ? object.table : '', ItemType.object, object, devInfoObject.icon, undefined));
        }
        return objectItems;
    }

    private getAttributeItems (attributes: any): TreeItem[] {
        if (!attributes) {
            return [];
        } 
        const attributeItems = new Array();
        const acceptedAttributes = ['activities', 'actions', 'fields', 'publications'];
        let technicalFlag = false; // add technical field only once
        let technicalAttributeName = '';
        let technicalAttribute = undefined;
        for (let attributeName in attributes) {
            if (attributes[attributeName].length === 0 || !acceptedAttributes.includes(attributeName)) {
                continue;
            }
            for (let item of attributes[attributeName]) {
                let itemName = '';
                let collapsibleState = TreeItemCollapsibleState.None;
                let description = '';
                let itemType = ItemType.attribute;
                let itemInfo = undefined;
                let additionalInfo = undefined;
                if (attributeName === 'activities') {
                   itemName = item.name;
                } else if (attributeName === 'actions') {
                    itemName = item.name;
                    description = item.method;
                } else if (attributeName === 'fields' && !item.technical) {
                    itemName = item.name;
                    description = item.column;
                    additionalInfo = item.jsonname;
                } else if (attributeName === 'publications') {
                    itemName = item.name;
                    description = item.method;
                } else if (attributeName === 'fields' && item.technical) {
                    if (!technicalFlag) {
                        technicalFlag = true;
                        technicalAttributeName = attributeName;
                        technicalAttribute = attributes[attributeName];
                    }
                    continue;
                }
                attributeItems.push(new CustomTreeItem(itemName, collapsibleState, description, itemType, itemInfo, attributeName, additionalInfo));
            }
            
        }
        if (technicalFlag){
            attributeItems.push(new CustomTreeItem('technical fields', TreeItemCollapsibleState.Collapsed, '', ItemType.technicalRoot, technicalAttribute, technicalAttributeName, '')); 
        }
        return attributeItems;
    }

    private getTechnicalFieldsItems (itemInfo: any): TreeItem[] {
        if (!itemInfo) {
            return [];
        }
        const technicalFieldItems = new Array();
        for (let field of itemInfo) {
            if (field.technical) {
                technicalFieldItems.push(new CustomTreeItem(field.name, TreeItemCollapsibleState.None, field.column, ItemType.technical, undefined, 'fields', field.jsonname));
            }
        }
        
        return technicalFieldItems;
    }

    insertFieldInDocument (logicName: string) {
        const editor = window.activeTextEditor;
        if (editor?.selection.isEmpty) {
            const position = editor.selection.active;
            editor.edit(e => {
                e.insert(position, logicName);
            });
        }
    }

    getObjectDevInfo (objectType: string): DevInfoObject | void {
        for (let object of this._devInfo.objects) {
            if (objectType === object.object) {
                return object;
            }
        }
    }
}

class CustomTreeItem extends TreeItem {
    objectType: ItemType;
    itemInfo: any; // saves a lot of loop and condition to access the moduleDevInfo datas
    additionalInfo: string | undefined; 
    constructor (label: string,
        treeItemCollapsibleState: TreeItemCollapsibleState,
        description: string,
        objectType: ItemType,
        itemInfo: any,
        iconName: string | undefined,
        additionalInfo: string | undefined) {
        super(label, treeItemCollapsibleState);
        this.description = description;
        this.objectType = objectType;
        this.itemInfo = itemInfo;
        if (iconName) {
            this.iconPath = vsCodeIconFormat(iconName);
        }
        this.additionalInfo = additionalInfo;
        this.command = { command: 'simplicite-vscode-tools.itemDoubleClickTrigger', title: '' , arguments: [label] };
    }
}

function vsCodeIconFormat (iconName: string) {
    return {
        light: path.join(__filename, '..', '..', '..', 'resources', 'light', iconName + '.svg'),
        dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', iconName + '.svg')
    };
}

enum ItemType {
    module = 'module',
    objectType = 'objectType',
    object = 'object',
    attribute = 'attribute',
    technicalRoot = 'technicalRoot',
    technical = 'technical'
}