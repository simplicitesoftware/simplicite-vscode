'use strict';

import { Uri } from 'vscode';
import { File } from './File';
import { Module } from './Module';

export interface CustomMessage {
	message: string;
	button: string;
}

export interface UrlAndName {
	instanceUrl: string;
	name: string;
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
	file: File;
	url: string;
}

export interface ApiModuleSave {
	moduleName: string;
	instanceUrl: string;
	workspaceName: string | undefined;
}

export interface SessionIdSave {
	sessionId: string;
	apiModules: Array<UrlAndName>
}

export enum ConflictAction {
	sendFile,
	fetchRemote,
	conflict,
	nothing
}



