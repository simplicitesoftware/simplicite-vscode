'use strict';

import { EventEmitter, TreeItem, Event, TreeDataProvider, TreeItemCollapsibleState, TreeItemLabel, Uri } from 'vscode';
import { ModuleItem, FileItem, UntrackedRootItem } from './treeViewClasses';
import { CustomFile } from '../CustomFile';
import path = require('path');
import { Module } from '../Module';

// File handler tree view
export class FileTree implements TreeDataProvider<TreeItem> {
	// this attribute and the below one are mandatory to refresh the component
	private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | void>; 
	readonly onDidChangeTreeData: Event<TreeItem | undefined | void>;
	runPath: string;
	modules: Module[];
	constructor(runPath: string) {
		this._onDidChangeTreeData = new EventEmitter<TreeItem | undefined | void>();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		this.runPath = runPath;
		this.modules = [];
	}

	public refresh(modules: Module[]): void {
		this.modules = modules;
		this._onDidChangeTreeData.fire();
		console.log("Refreshed file tree");
	}

	// sets the viewItem value, use in package.json to handle the commands linked to a specific item type
	getTreeItem(element: TreeItem): TreeItem {
		return element;
	}

	// this method is called:
	//   - on the component initialisation (automatically)
	//   - when the items are clicked and the collapsible state collapsibleState !== None
	//   - when refreshing the tree view 
	getChildren(element?: ModuleItem | FileItem | UntrackedRootItem): Thenable<TreeItem[]> {
		return new Promise((resolve) => {
			if(element === undefined) {
				resolve(this.getModulesItem(this.modules));
			} else if(element instanceof ModuleItem) {
				if(element.subModules.size > 0) {
					resolve(this.getModulesItem(Array.from(element.subModules.values())));
				} else if(element.files.size > 0) {
					resolve(this.getFilesItem(element.files, element.module));
				} else {
					resolve([new TreeItem('Module has no file', TreeItemCollapsibleState.None)]);
				}
			} else if (element instanceof UntrackedRootItem) {
				resolve(this.getUntrackedFiles(element.files, element.moduleName));
			} else {
				return resolve([]);
			}
		});
	}

	private async getModulesItem(modules: Module[]): Promise<TreeItem[]> {
		const moduleItems: TreeItem[] = [];
		for(const mod of modules) {
			const treeItem = new ModuleItem(mod, TreeItemCollapsibleState.Collapsed, this.runPath);
			moduleItems.push(treeItem);
		}
		return moduleItems;
	}

	// check if map properties can be used to access values without having to loop
	private getFilesItem(files: Map<string, CustomFile>, module: Module): Array<FileItem | UntrackedRootItem> {
		let fileItems: Array<FileItem> = [];
		let untrackedFlag = false;
		for (const file of files.values()) {
			if (file.getTrackedStatus()) {
				const legibleFileName = CustomFile.legibleFileName(file.uri.path);
				const treeItem = new FileItem(legibleFileName, TreeItemCollapsibleState.None, file.uri, true, module.name);
				fileItems.push(treeItem);
			} else {
				untrackedFlag = true;
			}
		}
		let orderedItems: Array<FileItem | UntrackedRootItem> = this.orderAlphab(fileItems);
		// if there is at least one untracked file
		// add a specific collapsible item to sort all the untracked files under the same category
		if (untrackedFlag) {
			orderedItems = orderedItems.concat([new UntrackedRootItem('Untracked files', TreeItemCollapsibleState.Collapsed, module)]);
		}
		return orderedItems;
	}

	// same as method above
	private getUntrackedFiles(files: Map<string, CustomFile>, moduleName: string): FileItem[] {
		const untrackedFiles: FileItem[] = [];
		for (const file of files.values()) {
			if (!file.getTrackedStatus()) {
				const legibleFileName = CustomFile.legibleFileName(file.uri.path);
				const treeItem = new FileItem(legibleFileName, TreeItemCollapsibleState.None, file.uri, false, moduleName);
				untrackedFiles.push(treeItem);
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
					if(typeof(item.label) === 'string') extensionObject.itemsPath.push(item.label);
				}
			}
		}
		const orderedFileItems = [];
		for (const extensionObject of extensionItemArray) {
			extensionObject.itemsPath.sort();
			for (const itemPath of extensionObject.itemsPath) {
				for (const item of fileItems) {
					if (item.resourceUri.path.includes(itemPath)) {
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
}