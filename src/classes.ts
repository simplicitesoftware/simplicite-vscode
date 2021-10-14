import { TreeItem, TreeItemCollapsibleState, TreeItemLabel } from 'vscode';
import { ObjectInfo } from './interfaces';

export class ObjectType extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly moduleName: string | TreeItemLabel,
    ) {
        super(label, collapsibleState);
        this.moduleName = moduleName;
    }
}

export class ObjectItem extends ObjectType {
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

export class FieldItem extends ObjectItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly moduleName: string | TreeItemLabel,
        public readonly objectInfo: ObjectInfo,
        public readonly description: string,
        public readonly technical: boolean,
        public readonly masterObject: string,
        public readonly commandId: string,
        public readonly jsonName: string
    ) {
        super(label, collapsibleState, moduleName, objectInfo, description);
        this.technical = technical;
        this.masterObject = masterObject;
        this.command = { command: commandId, title: '' , arguments: [label] };
        this.jsonName = jsonName;
    }
}

export class ModuleItem extends TreeItem {
    constructor (
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly description: string,
    ) {
        super(label, collapsibleState);    
        this.description = description;
    }
}

export class FileItem extends TreeItem {
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

export class UntrackedItem extends FileItem {
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