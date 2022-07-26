'use strict';

import { Uri } from 'vscode';
import { File } from './File';
import { Module } from './Module';

export interface CustomMessage {
	message: string;
	button: string;
}

// usefull object to bind files with their corresponding module
export interface FileAndModule {
	module: Module;
	fileList: File[];
}

export interface UrlAndName {
	instanceUrl: string;
	name: string;
}

export interface NameAndWorkspacePath {
	name: string;
	wkPath: string;
}

export interface Credentials {
	userName: string;
	password: string;
}

export interface ModulesFiles {
	moduleName: string;
	files: string[];
}

export interface InstanceModules {
	url: string;
	modules: ModulesFiles[];
}

export interface FileInstance {
	file: File;
	url: string;
}

export interface ApiModuleSave {
	moduleName: string;
	instanceUrl: string;
	workspaceName: string | undefined;
}



