'use strict';

import { EventEmitter, TreeItem, Event, TreeDataProvider, TreeItemCollapsibleState, TreeItemLabel } from "vscode";
import { FileAndModule } from '../interfaces';
import * as path from 'path';

export class FileTree implements TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void>;
    readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void>;
    fileModule?: FileAndModule[];
    constructor () {
        this._onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    async refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem (element: TreeItem): TreeItem {
        if (!element.description && element.label !== 'No files to display') {
            element.contextValue = 'file';
        }
        return element;
    }

    getChildren (element: TreeItem): Thenable<TreeItem[]> { 
        if (this.fileModule) {
            if (element === undefined) {
                return Promise.resolve(this.getModulesItem());
            } else if (element.label) {
                return Promise.resolve(this.getFilesItem(element.label));
            }
        }
        return Promise.resolve([new TreeItem('No file has been changed', TreeItemCollapsibleState.None)]);
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
            if (fm.fileList.length > 0 && fm.moduleName === label) {
                for (let file of fm.fileList) {
                    const treeItem = new FileItem(this.legibleFileName(file.getFilePath()), TreeItemCollapsibleState.None, file.getFilePath());
                    treeItem.iconPath = {
                        light: path.join(__filename, '..', '..', 'resources', 'light', 'file.svg'),
                        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'file.svg')
                    };
                    fileItems.push(treeItem);
                }
            }
        }
        if (fileItems.length === 0) {
            fileItems.push(new TreeItem('No files to display', TreeItemCollapsibleState.None));
        }
        return fileItems;
    }

    private legibleFileName (filePäth: string) {
        const decomposedPath = filePäth.split('/');
        const index = decomposedPath.length - 1;
        return decomposedPath[index- 2] + '/' + decomposedPath[index - 1] + '/' + decomposedPath[index];
    }

    async setFileModule (fileModule: any) {
        this.fileModule = fileModule;
        await this.refresh();
    }
}

class ModuleItem extends TreeItem {
    constructor (
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly description: string,
    ) {
        super(label, collapsibleState);    
        this.description = description;
    }
}

class FileItem extends TreeItem {
    constructor (
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly fullPath: string
    ) {
        super(label, collapsibleState);
        this.fullPath = fullPath;
    }
}