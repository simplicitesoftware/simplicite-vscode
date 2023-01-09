'use strict';

import { TreeItemCollapsibleState, EventEmitter, TreeItem, Event, TreeDataProvider, window } from 'vscode';
import { Module } from '../Module';
import * as path from 'path';
import { DevInfo, DevInfoObject,  } from '../DevInfo';
import { ApiModule } from '../ApiModule';

export class ModuleInfoTree implements TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void>; // see comment on FileTree.ts for these 2 attributes
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void>;
	private _modules: Array<Module> | undefined;
	private _devInfo?: DevInfo;
	private _runPath: string;
	constructor(runPath: string) {
		this._onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		this._modules = [];
		this._devInfo = undefined;
		this._runPath = runPath;
	}

	public refresh(devInfo: any, modules: Module[]) {
		this._devInfo = devInfo;
		this.setModules(modules);
		this._onDidChangeTreeData.fire();
		console.log("Refreshed module info tree");
	}

	private setModules(modules: Array<Module>): void {
		this._modules = [];
		const addedModules: string[] = []; // avoid adding the same module
		for (const module of modules) {	
			if (addedModules.includes(module.name)) continue;
			this._modules.push(module);
			addedModules.push(module.name);
		}
	}

	getTreeItem(element: CustomTreeItem | TreeItem): CustomTreeItem | TreeItem {
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

	async getChildren(element: CustomTreeItem): Promise<TreeItem[]> {
		if (element === undefined) {
			return Promise.resolve(this.getModulesItems());
		} else if (element.objectType === ItemType.module) {
			if(element.itemInfo.subModules.size !== 0) return Promise.resolve(this.getSubModules(element.itemInfo.subModules));
			return Promise.resolve(this.getObjectTypesItems(element.itemInfo));
		} else if (element.objectType === ItemType.objectType) {
			if (typeof element.label !== 'string') {
				return Promise.resolve([]);
			}
			const devInfo = this.getObjectDevInfo(element.label);
			if (!devInfo) {
				return Promise.resolve([]);
			}
			return Promise.resolve(this.getObjectItems(element.itemInfo, devInfo));
		} else if (element.objectType === ItemType.object) {
			return Promise.resolve(this.getAttributeItems(element.itemInfo));
		} else if (element.objectType === ItemType.technicalRoot) {
			return Promise.resolve(this.getTechnicalFieldsItems(element.itemInfo));
		}
		return Promise.resolve([]);
	}

	private getModulesItems(): CustomTreeItem[] {
		if (!this._modules) {
			return [];
		}
		const modulesItems = [];
		for (const module of this._modules) {
			if (!module.moduleDevInfo) continue;
			modulesItems.push(new CustomTreeItem(module.name, TreeItemCollapsibleState.Collapsed, module.instanceUrl, ItemType.module, module, 'module', undefined, this._runPath));
		}
		return modulesItems;
	}

	private getSubModules(subModules: Map<String, Module | ApiModule>): CustomTreeItem[] {
		const moduleItems = [];
		for(const mod of subModules.values()) {
			moduleItems.push(new CustomTreeItem(mod.name, TreeItemCollapsibleState.Collapsed, mod.instanceUrl, ItemType.module, mod, 'module', undefined, this._runPath));
		}
		return moduleItems;
	}

	private getObjectTypesItems(module: Module): TreeItem[] {
		const moduleDevInfo = module.moduleDevInfo;
		if (!moduleDevInfo) {
			return [];
		}
		const objectTypesItems = [];
		for (const type in moduleDevInfo) {
			if (type === 'name' || type === 'version' || moduleDevInfo[type].length === 0) continue;
			objectTypesItems.push(new CustomTreeItem(type, TreeItemCollapsibleState.Collapsed, '', ItemType.objectType, moduleDevInfo[type], '', undefined, this._runPath));
		}
		return objectTypesItems;
	}

	private getObjectItems(objects: any, devInfoObject: DevInfoObject | void): TreeItem[] {
		if (!objects || !devInfoObject) {
			return [];
		}
		const objectItems = [];
		for (const object of objects) {
			let collapsibleState = TreeItemCollapsibleState.None;
			if (devInfoObject.completion !== undefined) {
				collapsibleState = TreeItemCollapsibleState.Collapsed;
			}
			objectItems.push(new CustomTreeItem(object.name, collapsibleState, object.table ? object.table : '', ItemType.object, object, devInfoObject.icon, undefined, this._runPath));
		}
		return objectItems;
	}

	private getAttributeItems(attributes: any): TreeItem[] {
		if (!attributes) {
			return [];
		}
		const attributeItems = [];
		const acceptedAttributes = ['activities', 'actions', 'fields', 'publications'];
		let technicalFlag = false; // add technical field only once
		let technicalAttributeName = '';
		let technicalAttribute = undefined;
		for (const attributeName in attributes) {
			if (attributes[attributeName].length === 0 || !acceptedAttributes.includes(attributeName)) continue;
			for (const item of attributes[attributeName]) {
				let itemName = '';
				const collapsibleState = TreeItemCollapsibleState.None;
				let description = '';
				const itemType = ItemType.attribute;
				const itemInfo = undefined;
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
				attributeItems.push(new CustomTreeItem(itemName, collapsibleState, description, itemType, itemInfo, attributeName, additionalInfo, this._runPath));
			}

		}
		if (technicalFlag) {
			attributeItems.push(new CustomTreeItem('technical fields', TreeItemCollapsibleState.Collapsed, '', ItemType.technicalRoot, technicalAttribute, technicalAttributeName, '', this._runPath));
		}
		return attributeItems;
	}

	private getTechnicalFieldsItems(itemInfo: any): TreeItem[] {
		if (!itemInfo) {
			return [];
		}
		const technicalFieldItems = [];
		for (const field of itemInfo) {
			if (field.technical) {
				technicalFieldItems.push(new CustomTreeItem(field.name, TreeItemCollapsibleState.None, field.column, ItemType.technical, undefined, 'fields', field.jsonname, this._runPath));
			}
		}

		return technicalFieldItems;
	}

	insertFieldInDocument(logicName: string): void {
		const editor = window.activeTextEditor;
		if (editor?.selection.isEmpty) {
			const position = editor.selection.active;
			editor.edit(e => {
				e.insert(position, logicName);
			});
		}
	}

	getObjectDevInfo(objectType: string): DevInfoObject | void {
		if (!this._devInfo) return;
		for (const object of this._devInfo.objects) {
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
	constructor(label: string,
		treeItemCollapsibleState: TreeItemCollapsibleState,
		description: string,
		objectType: ItemType,
		itemInfo: any,
		iconName: string | undefined,
		additionalInfo: string | undefined,
		_runPath: string) {
		super(label, treeItemCollapsibleState);
		this.description = description;
		this.objectType = objectType;
		this.itemInfo = itemInfo;
		if (iconName) {
			this.iconPath = vsCodeIconFormat(iconName, _runPath);
		}
		this.additionalInfo = additionalInfo;
		this.command = { command: 'simplicite-vscode-tools.itemDoubleClickTrigger', title: '', arguments: [label] };
	}
}

function vsCodeIconFormat(iconName: string, _runPath: string) {
	return {
		light: path.join(_runPath, 'resources', 'light', iconName + '.svg'),
		dark: path.join(_runPath, 'resources', 'dark', iconName + '.svg')
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