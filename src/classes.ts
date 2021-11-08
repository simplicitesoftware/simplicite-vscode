import { TreeItem, TreeItemCollapsibleState, TreeItemLabel, ThemeIcon, Uri } from 'vscode';

export class ModuleItem extends TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly description: string,
	) {
		super(label, collapsibleState);
		this.description = description;
	}
}

export class FileItem extends TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly fullPath: string,
		public readonly tracked: boolean,
		public readonly moduleName: string | TreeItemLabel
	) {
		super(label, collapsibleState);
		this.fullPath = fullPath;
		this.moduleName = moduleName;
		this.iconPath = ThemeIcon.File;
		this.resourceUri = Uri.file(fullPath);
	}
}

export class UntrackedItem extends FileItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly fullPath: string,
		public readonly tracked: boolean,
		public readonly moduleName: string | TreeItemLabel
	) {
		super(label, collapsibleState, fullPath, tracked, moduleName);
	}
}