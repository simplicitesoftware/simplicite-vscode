'use strict';

import { Uri } from 'vscode';
import { Module } from './Module';
import { FileAndModule } from './interfaces';
import { File } from './File';

export function crossPlatformPath(path: string): string {
	if (path[0] === '/' || path[0] === '\\') {
		path = path.slice(1);
	}
	return replaceAll(path, '\\\\', '/');
}

export function replaceAll(str: string, find: string | RegExp, replace: string): string {
	const regex = new RegExp(find, 'g');
	return str.replace(regex, replace);
}

export function validFileExtension(template: string): boolean {
	for (const extension of SUPPORTED_FILES) {
		if (template.includes(extension) && checkExclude(template)) {
			return true;
		}
	}
	return false;
}

function checkExclude(template: string): boolean {
	for (const exclude of EXCLUDED_FILES) {
		if (template.includes(exclude)) {
			return false;
		}
	}
	return true;
}

export function removeFileExtension(template: string): string {
	let fileName = template;
	for (const valid of SUPPORTED_FILES) {
		const beforeLegnth = fileName.length;
		fileName = template.replace(valid, '');
		if (beforeLegnth > fileName.length) {
			break;
		}
	}
	return fileName;
}

export function getModuleFromWorkspacePath(wkPath: string, modules: Module[]): Module | false {
	for (const module of modules) {
		if (module.workspaceFolderPath === wkPath) {
			return module;
		}
	}
	return false;
}

export function bindFileAndModule(modules: Array<Module>, files: File[]): FileAndModule[] {
	const fileModule = [];
	for (const module of modules) {
		if (module.apiFileSystem) continue;
		const moduleObject: FileAndModule = { parentFolderName: module.name, instanceUrl: module.instanceUrl, fileList: [] };
		for (const file of files) {
			if (file.workspaceFolderPath === module.workspaceFolderPath) {
				moduleObject.fileList.push(file);
			}
		}
		fileModule.push(moduleObject);
	}
	return fileModule;
}

export function extensionStoragePathMaker (path: string): Uri {
	const decomposed = path.split('/');
	decomposed.splice(decomposed.length - 1);
	const newPath = decomposed.join('/');
	const uri = Uri.parse(newPath + '/');
	return uri;
}