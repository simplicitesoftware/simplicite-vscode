'use strict';

import { Uri } from 'vscode';
import { File } from './File';

export interface CustomMessage {
	message: string;
	button: string;
}

export interface FieldInfo {
	moduleName: string;
	objectFields: Array<any>;
	instanceUrl: string;
}

export interface ObjectInfo {
	objectType: string,
	field: string,
	icons: { dark: string | Uri, light: string | Uri },
	fieldIcons: { dark: string | Uri, light: string | Uri }
}

// usefull object when working with modules and files
export interface FileAndModule {
	parentFolderName: string,
	instanceUrl: string,
	fileList: File[],
}

export interface OpenFileContext {
	filePath: string,
	fileName: string,
	workspaceUrl: string,
	instanceUrl: string
}

export interface ModuleDevInfo {
	classnamefield: string | undefined,
	completion: any,
	icon: string,
	keyfield: string,
	object: any,
	package: string | undefined,
	sourcefield: string
}

export interface PomXMLData {
	instanceUrl: string,
	name: string
}

export interface Credentials {
	userName: string;
	password: string;
}

export interface ModuleObject {
	moduleName: string,
	instanceUrl: string,
	fileList: File[]
}