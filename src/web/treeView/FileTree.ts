'use strict';

import { EventEmitter, TreeItem, Event, TreeDataProvider, TreeItemCollapsibleState, TreeItemLabel, Uri } from 'vscode';
import { UntrackedItem, ModuleItem, FileItem } from './treeViewClasses';
import { SimpliciteInstance } from '../SimpliciteInstance';
import path = require('path');
import { ApiModule } from '../ApiModule';

// File handler tree view
export class FileTree implements TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void>; // this attribute and the below one are mandatory to refresh the component
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void>;
	runPath: string;
	instances: SimpliciteInstance[] | undefined;
	constructor(runPath: string) {
		this._onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		this.runPath = runPath;
		this.instances;
	}

	public refresh(instances: SimpliciteInstance[]): void {
		this.instances = instances;
		this._onDidChangeTreeData.fire();
	}

	// sets the viewItem value, use in package.json to handle the commands linked to a specific item type
	getTreeItem(element: UntrackedItem): UntrackedItem {
		if (element.tracked === undefined && element.label !== 'Untracked files' && element.label !== 'No files to display' && element.label !== 'No file has been changed') {
			element.contextValue = 'module';
		} else if (!element.tracked && element.label !== 'Untracked files' && element.label !== 'No files to display' && element.label !== 'No file has been changed') {
			element.contextValue = 'untrackedFile';
		} else if (element.tracked && element.label !== 'Untracked files' && element.label !== 'No files to display' && element.label !== 'No file has been changed') {
			element.contextValue = 'file';
		}
		return element;
	}

	// this method is called:
	//   - on the component initialisation (automatically)
	//   - when the items are clicked and the collapsible state collapsibleState !== None
	//   - when refreshing the tree view 
	getChildren(element: TreeItem): Thenable<TreeItem[]> {
		if (element === undefined) {
			return Promise.resolve(this.getModulesItem());
		} else if (element.label && !(element instanceof UntrackedItem)) {
			// todo , check if instanceUrl is available at this points
			return Promise.resolve(this.getFilesItem(element.label));
		} else if (element instanceof UntrackedItem) {
			return Promise.resolve(this.getUntrackedFiles(element.moduleName));
		}
		return Promise.resolve([]);
	}

	private async getModulesItem(): Promise<TreeItem[]> {
		const moduleItems: TreeItem[] = [];
		for (const instance of this.instances || []) {
			for(const mod of instance.modules.values()) {
				const treeItem = new ModuleItem(mod.name, TreeItemCollapsibleState.Collapsed, mod.instanceUrl, mod instanceof ApiModule ? mod.apiModuleName : undefined);
				treeItem.iconPath = {
					light: path.join(this.runPath, 'resources/light/module.svg'),
					dark: path.join(this.runPath, 'resources/dark/module.svg')
				};
				moduleItems.push(treeItem);
			}
		}
		return moduleItems;
	}

	// check if map properties can be used to access values without having to loop
	private getFilesItem(label: string | TreeItemLabel): FileItem[] | TreeItem[] {
		const fileItems: FileItem[] = [];
		let untrackedFlag = false;
		for (const instance of this.instances || []) {
			for (const mod of instance.modules.values()) {
				if (mod.name === label) {
					for (const file of mod.files.values()) {
						if (file.getTrackedStatus()) {
							const legibleFileName = this.legibleFileName(file.uri.path);
							const treeItem = new FileItem(legibleFileName, TreeItemCollapsibleState.None, file.uri, true, label);
							fileItems.push(treeItem);
						} else {
							untrackedFlag = true;
						}
					}
				}
			}
		}
		// if there is at least one untracked file
		// add a specific collapsible item to sort all the untracked files under the same category
		if (untrackedFlag) {
			const orderedItems = this.orderAlphab(fileItems);
			const treeItem = new UntrackedItem('Untracked files', TreeItemCollapsibleState.Collapsed, Uri.file(''), false, label);
			orderedItems.push(treeItem);
			untrackedFlag = false;
			return orderedItems;
		}
		return this.orderAlphab(fileItems);
	}

	// same as method above
	private getUntrackedFiles(moduleName: string | TreeItemLabel): TreeItem[] {
		const untrackedFiles = [];
		for (const instance of this.instances || []) {
			for(const mod of instance.modules.values()) {
				if (mod.name === moduleName) {
					for (const file of mod.files.values()) {
						if (!file.getTrackedStatus()) {
							const legibleFileName = this.legibleFileName(file.uri.path);
							const treeItem = new FileItem(legibleFileName, TreeItemCollapsibleState.None, file.uri, false, moduleName);
							untrackedFiles.push(treeItem);
						}
					}
				}
			}
		}
		return this.orderAlphab(untrackedFiles);
	}

	// sorts the fileItems in alphabetical order
	orderAlphab(fileItems: FileItem[]): FileItem[] {
		const extensionItemArray: Array<{ extension: string, itemsPath: string[] }> = [];
		for (const extension of SUPPORTED_FILES) {
			extensionItemArray.push({ extension: extension, itemsPath: [] });
		}
		for (const item of fileItems) {
			for (const extensionObject of extensionItemArray) {
				if (this.getPathExtension(item.resourceUri.path) === extensionObject.extension) {
					extensionObject.itemsPath.push(item.label.toLowerCase());
				}
			}
		}
		const orderedFileItems = [];
		for (const extensionObject of extensionItemArray) {
			extensionObject.itemsPath.sort();
			for (const itemPath of extensionObject.itemsPath) {
				for (const item of fileItems) {
					const lowerCaseValue = item.resourceUri.path;
					if (lowerCaseValue.toLowerCase().includes(itemPath)) {
						orderedFileItems.push(item);
					}
				}
			}
		}
		return orderedFileItems;
	}

	private getPathExtension(template: string): string {
		const decomposed = template.split('.');
		return '.' + decomposed[decomposed.length - 1];
	}

	// returns a part of the file path for tree view readability
	private legibleFileName(filePath: string) {
		const decomposedPath = filePath.split('/');
		const index = decomposedPath.length - 1;
		return decomposedPath[index - 2] + '/' + decomposedPath[index - 1] + '/' + decomposedPath[index];
	}
}