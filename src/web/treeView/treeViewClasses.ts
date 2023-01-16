import { TreeItem, TreeItemCollapsibleState, TreeItemLabel, ThemeIcon, Uri } from 'vscode';
import { CustomFile } from '../CustomFile';
import { Module } from '../Module';
import path = require('path');
import { ApiModule } from '../ApiModule';

export class ModuleItem extends TreeItem {
	subModules: Map<string, Module>;
	files: Map<string, CustomFile>;
	moduleName: string;
	apiName?: string;
	constructor(
		public readonly module: Module, 
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly runPath: string,
	) {
		super(module.name, collapsibleState);
		if(module instanceof ApiModule) this.apiName = module.apiModuleName;
		this.files = module.files;
		this.moduleName = module.name;
		this.description = module.instanceUrl;
		this.subModules = module.subModules;
	}

	iconPath = {
		light: path.join(this.runPath, 'resources/light/module.svg'),
		dark: path.join(this.runPath, 'resources/dark/module.svg')
	};

	contextValue = 'module';
}

export class FileItem extends TreeItem {
	constructor(
		public readonly label: string | TreeItemLabel,
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

export class UntrackedRootItem extends TreeItem {
	files: Map<string, CustomFile>;
	moduleName: string;
	constructor(
		public readonly label: string | TreeItemLabel,
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly module: Module
	) {
		super(label, collapsibleState);
		this.files = module.files;
		this.moduleName  = module.name;
	}
}