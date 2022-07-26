// 'use strict';

// import { EventEmitter, TreeItem, Event, TreeDataProvider, TreeItemCollapsibleState, TreeItemLabel, Uri } from 'vscode';
// import { FileAndModule } from '../interfaces';
// import { UntrackedItem, ModuleItem, FileItem } from './treeViewClasses';
// import { bindFileAndModule } from '../utils';
// import { Module } from '../Module';
// import { File } from '../File';
// import * as path from 'path';

// // File handler tree view
// export class FileTree implements TreeDataProvider<TreeItem> {
// 	private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void>; // this attribute and the below one are mandatory to refresh the component
// 	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void>;
// 	fileModule: FileAndModule[]; // is set in setFileModule, which is called on every file changes (fileDetector() & setTrackedStatus())
// 	runPath: string;
// 	constructor(runPath: string, modules: Module[], files: File[]) {
// 		this._onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
// 		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
// 		this.fileModule = bindFileAndModule(modules, files);
// 		this.runPath = runPath;
// 	}

// 	refresh(): void {
// 		this._onDidChangeTreeData.fire();
// 	}

// 	async setFileModule(modules: Module[], fileList: File[]): Promise<void> {
// 		this.fileModule = bindFileAndModule(modules, fileList);
// 		this.refresh();
// 	}

// 	// sets the viewItem value, use in package.json to handle the commands linked to a specific item type
// 	getTreeItem(element: UntrackedItem): UntrackedItem {
// 		if (element.tracked === undefined && element.label !== 'Untracked files' && element.label !== 'No files to display' && element.label !== 'No file has been changed') {
// 			element.contextValue = 'module';
// 		} else if (!element.tracked && element.label !== 'Untracked files' && element.label !== 'No files to display' && element.label !== 'No file has been changed') {
// 			element.contextValue = 'untrackedFile';
// 		} else if (element.tracked && element.label !== 'Untracked files' && element.label !== 'No files to display' && element.label !== 'No file has been changed') {
// 			element.contextValue = 'file';
// 		}
// 		return element;
// 	}

// 	// this method is called:
// 	//   - on the component initialisation (automatically)
// 	//   - when the items are clicked and the collapsible state collapsibleState !== None
// 	//   - when refreshing the tree view 
// 	getChildren(element: TreeItem): Thenable<TreeItem[]> {
// 		if (this.fileModule) {
// 			if (element === undefined) {
// 				return Promise.resolve(this.getModulesItem());
// 			} else if (element.label && !(element instanceof UntrackedItem)) {
// 				return Promise.resolve(this.getFilesItem(element.label));
// 			} else if (element instanceof UntrackedItem) {
// 				return Promise.resolve(this.getUntrackedFiles(element.moduleName));
// 			}
// 		}
// 		return Promise.resolve([]);
// 	}

// 	private async getModulesItem(): Promise<TreeItem[]> {
// 		const moduleItems: TreeItem[] = [];
// 		if (this.fileModule === undefined) {
// 			return [];
// 		}
// 		for (const fm of this.fileModule) {
// 			const treeItem = new ModuleItem(fm.module.name, TreeItemCollapsibleState.Collapsed, fm.module.instanceUrl);
// 			treeItem.iconPath = {
// 				light: path.join(this.runPath, 'resources/light/module.svg'),
// 				dark: path.join(this.runPath, 'resources/dark/module.svg')
// 			};
// 			moduleItems.push(treeItem);
// 		}
// 		return moduleItems;
// 	}

// 	private getFilesItem(label: string | TreeItemLabel): FileItem[] | TreeItem[] {
// 		const fileItems: FileItem[] = [];
// 		if (this.fileModule === undefined) {
// 			return [];
// 		}
// 		for (const fm of this.fileModule) {
// 			let untrackedFlag = false;
// 			if (fm.fileList.length > 0 && fm.module.name === label) {
// 				for (const file of fm.fileList) {
// 					if (file.tracked) {
// 						const legibleFileName = this.legibleFileName(file.uri.path);
// 						const treeItem = new FileItem(legibleFileName, TreeItemCollapsibleState.None, file.uri, true, label);
// 						fileItems.push(treeItem);
// 					} else {
// 						untrackedFlag = true;
// 					}
// 				}
// 			}
// 			// if there is at least one untracked file
// 			// add a specific item to these type of files 
// 			if (untrackedFlag) {
// 				const orderedItems = this.orderAlphab(fileItems);
// 				const treeItem = new UntrackedItem('Untracked files', TreeItemCollapsibleState.Collapsed, Uri.file(''), false, label);
// 				orderedItems.push(treeItem);
// 				untrackedFlag = false;
// 				return orderedItems;
// 			}
// 		}
// 		if (fileItems.length === 0) {
// 			return [];
// 		}
// 		return this.orderAlphab(fileItems);
// 	}

// 	private getUntrackedFiles(moduleName: string | TreeItemLabel): TreeItem[] {
// 		const untrackedFiles = [];
// 		if (this.fileModule) {
// 			for (const fm of this.fileModule) {
// 				if (fm.fileList.length > 0 && fm.module.name === moduleName) {
// 					for (const file of fm.fileList) {
// 						if (!file.tracked) {
// 							const legibleFileName = this.legibleFileName(file.uri.path);
// 							const treeItem = new FileItem(legibleFileName, TreeItemCollapsibleState.None, file.uri, false, moduleName);
// 							untrackedFiles.push(treeItem);
// 						}
// 					}
// 				}
// 			}
// 		}
// 		return this.orderAlphab(untrackedFiles);
// 	}

// 	// sorts the fileItems in alphabetical order
// 	orderAlphab(fileItems: FileItem[]): FileItem[] {
// 		const extensionItemArray: Array<{ extension: string, itemsPath: string[] }> = [];
// 		for (const extension of SUPPORTED_FILES) {
// 			extensionItemArray.push({ extension: extension, itemsPath: [] });
// 		}
// 		for (const item of fileItems) {
// 			for (const extensionObject of extensionItemArray) {
// 				if (this.getPathExtension(item.resourceUri.path) === extensionObject.extension) {
// 					extensionObject.itemsPath.push(item.label.toLowerCase());
// 				}
// 			}
// 		}
// 		const orderedFileItems = [];
// 		for (const extensionObject of extensionItemArray) {
// 			extensionObject.itemsPath.sort();
// 			for (const itemPath of extensionObject.itemsPath) {
// 				for (const item of fileItems) {
// 					const lowerCaseValue = item.resourceUri.path;
// 					if (lowerCaseValue.toLowerCase().includes(itemPath)) {
// 						orderedFileItems.push(item);
// 					}
// 				}
// 			}
// 		}
// 		return orderedFileItems;
// 	}

// 	private getPathExtension(template: string): string {
// 		const decomposed = template.split('.');
// 		return '.' + decomposed[decomposed.length - 1];
// 	}

// 	// returns a part of the file path for tree view readability
// 	private legibleFileName(filePath: string) {
// 		const decomposedPath = filePath.split('/');
// 		const index = decomposedPath.length - 1;
// 		return decomposedPath[index - 2] + '/' + decomposedPath[index - 1] + '/' + decomposedPath[index];
// 	}
// }