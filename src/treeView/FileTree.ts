'use strict';

import { EventEmitter, TreeItem, Event, TreeDataProvider, TreeItemCollapsibleState, TreeItemLabel } from "vscode";
import { FileAndModule } from '../interfaces';
import * as path from 'path';
import { UntrackedItem, ModuleItem, FileItem } from "../classes";

// File handler tree view
export class FileTree implements TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void>; // these 2 attributes are mandatory to refresh the component
    readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void>;
    fileModule?: FileAndModule[]; // is set in setFileModule, which is called on every file changes (FileHandler: build() & setTrackedStatus())
    constructor () {
        this._onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    async setFileModule (fileModule: FileAndModule[]) {
        this.fileModule = fileModule;
        this.refresh();
    }

    // sets the viewItem value use in package.json to handle the commands linked to a specific item type
    getTreeItem (element: UntrackedItem): UntrackedItem {
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
    getChildren (element: TreeItem): Thenable<TreeItem[]> { 
        if (this.fileModule) {
            if (element === undefined) {
                return Promise.resolve(this.getModulesItem());
            } else if (element.label && !(element instanceof UntrackedItem)) {
                return Promise.resolve(this.getFilesItem(element.label));
            } else if (element instanceof UntrackedItem) {
                return Promise.resolve(this.getUntrackedFiles(element.moduleName));
            }
        }
        return Promise.resolve([new TreeItem('Nothing to display', TreeItemCollapsibleState.None)]);
    }

    private getModulesItem (): TreeItem[] {
        const moduleItems: TreeItem[] = new Array();
        for (let fm of this.fileModule!) {
            const treeItem = new ModuleItem(fm.moduleName, TreeItemCollapsibleState.Collapsed, fm.instanceUrl);
            treeItem.iconPath = {
                light: path.join(__filename, '..', '..', 'resources', 'light', 'module.svg'),
                dark: path.join(__filename, '..', '..', 'resources', 'dark', 'module.svg')
            };
            moduleItems.push(treeItem);
        }
        return moduleItems;
    }

    private getFilesItem (label: string | TreeItemLabel): TreeItem[] {
        const fileItems: TreeItem[] = new Array();
        for (let fm of this.fileModule!) {
            let untrackedFlag = false;
            if (fm.fileList.length > 0 && fm.moduleName === label) {
                for (let file of fm.fileList) {
                    if (file.tracked) {
                        const treeItem = new FileItem(this.legibleFileName(file.getFilePath()), TreeItemCollapsibleState.None, file.getFilePath(), true, label);
                        treeItem.iconPath = {
                            light: path.join(__filename, '..', '..', 'resources', 'light', 'sync.svg'),
                            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'sync.svg')
                        };
                        fileItems.push(treeItem);
                    } else {
                        untrackedFlag = true;
                    }
                }
            }
            // if there is at least one untracked file
            // add a specific item to these type of files 
            if (untrackedFlag) { 
                const treeItem = new UntrackedItem('Untracked files', TreeItemCollapsibleState.Collapsed, '', false, label);
                fileItems.push(treeItem);
                untrackedFlag = false;
            }
        }
        
        if (fileItems.length === 0) {
            fileItems.push(new TreeItem('No files to display', TreeItemCollapsibleState.None));
        }
        return this.orderAlphab(fileItems);
    }

    private getUntrackedFiles (moduleName: string | TreeItemLabel): TreeItem[] {
        const untrackedFiles = new Array();
        if (this.fileModule) {
            for (let fm of this.fileModule) {
                if (fm.fileList.length > 0 && fm.moduleName === moduleName) {
                    for (let file of fm.fileList) {
                        if (!file.tracked) {
                            const treeItem = new FileItem(this.legibleFileName(file.getFilePath()), TreeItemCollapsibleState.None, file.getFilePath(), false, '');
                            treeItem.iconPath = treeItem.iconPath = {
                                light: path.join(__filename, '..', '..', 'resources', 'light', 'nosync.svg'),
                                dark: path.join(__filename, '..', '..', 'resources', 'dark', 'nosync.svg')
                            };
                            untrackedFiles.push(treeItem);
                        }
                    }
                }
            }
        }
        return this.orderAlphab(untrackedFiles);
    }

    // sorts the fileItems in alphabetical order
    orderAlphab (fileItems: TreeItem[]): TreeItem[] {
        const fileItemPath = new Array();
        let untrackedItem: TreeItem | undefined = undefined;
        for (let file of fileItems) {
            if (file.label === 'Untracked files') {
                untrackedItem = file;
                continue;
            }
            fileItemPath.push(file.label);
        }
        fileItemPath.sort();
        const orderedFileItems = new Array();
        for (let ordered of fileItemPath) {
            for (let file of fileItems) {
                if (ordered === file.label) {
                    orderedFileItems.push(file);
                }
            }
        }
        if (untrackedItem) {
            orderedFileItems.push(untrackedItem);
        }
        return orderedFileItems;
    }

    // returns a part of the file path for tree view readability
    private legibleFileName (filePäth: string) {
        const decomposedPath = filePäth.split('/');
        const index = decomposedPath.length - 1;
        return decomposedPath[index- 2] + '/' + decomposedPath[index - 1] + '/' + decomposedPath[index];
    }
}