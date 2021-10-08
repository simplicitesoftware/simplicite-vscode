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
            if (untrackedFlag) {
                const treeItem = new UntrackedItem('Untracked files', TreeItemCollapsibleState.Collapsed, '', false, label);
                fileItems.push(treeItem);
                untrackedFlag = false;
            }
        }
        
        if (fileItems.length === 0) {
            fileItems.push(new TreeItem('No files to display', TreeItemCollapsibleState.None));
        }
        return fileItems;
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
        return untrackedFiles;
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
        public readonly fullPath: string,
        public readonly tracked: boolean,
        public readonly moduleName: string | TreeItemLabel
    ) {
        super(label, collapsibleState);
        this.fullPath = fullPath;
        this.moduleName = moduleName;
    }
}

class UntrackedItem extends FileItem {
    constructor (
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly fullPath: string,
        public readonly tracked: boolean,
        public readonly moduleName: string | TreeItemLabel
    ) {
        super(label, collapsibleState, fullPath, tracked, moduleName);
    }
}