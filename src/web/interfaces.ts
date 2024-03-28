'use strict';

import { Uri } from 'vscode';
import { CustomFile } from './CustomFile';
import { Module } from './Module';

export interface CustomMessage {
	message: string;
	button: string;
}

export interface ModulePomInfo {
	instanceUrl: string;
	name: string;
	subModules: string[]
}

export interface ModuleInfo {
	name: string;
	wkUri: Uri;
	modules: ModuleInfo[];
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
	file: CustomFile;
	url: string;
}

export interface ApiModuleSave {
	moduleName: string;
	instanceUrl: string;
	//workspaceName: string | undefined;
}

export interface SessionIdSave {
	sessionId: string;
	apiModules: Array<ModulePomInfo>
}

export enum ConflictAction {
	sendFile,
	fetchRemote,
	conflict,
	nothing
}



