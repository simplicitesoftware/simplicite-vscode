import { TreeItem, TreeItemCollapsibleState, TreeItemLabel, ThemeIcon, Uri } from 'vscode';

export class ModuleItem extends TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly description: string,
		public readonly apiName: string | undefined,
	) {
		super(label, collapsibleState);
		this.description = description;
		this.apiName = apiName;
	}
}

export class FileItem extends TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly resourceUri: Uri,
		public readonly tracked: boolean,
		public readonly moduleName: string | TreeItemLabel
	) {
		super(label, collapsibleState);
		this.resourceUri = resourceUri;
		this.moduleName = moduleName;
		this.iconPath = ThemeIcon.File;
	}
}

export class UntrackedItem extends FileItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly uri: Uri,
		public readonly tracked: boolean,
		public readonly moduleName: string | TreeItemLabel
	) {
		super(label, collapsibleState, uri, tracked, moduleName);
	}
}