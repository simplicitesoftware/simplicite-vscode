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
	module: Module,
	fileList: File[],
}

export interface PomXMLData {
	instanceUrl: string,
	name: string
}

export interface Credentials {
	userName: string;
	password: string;
}



