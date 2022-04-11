'use strict';

import { Module } from './Module';
import { FileAndModule } from './interfaces';
import { File } from './File';

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
		// todo
		// if (module.workspaceFolderPath === wkPath) {
		// 	return module;
		// }
	}
	return false;
}

export function bindFileAndModule(modules: Array<Module>, files: File[]): FileAndModule[] {
	const fileModule = [];
	for (const module of modules) {
		const moduleObject: FileAndModule = { module: module, fileList: [] };
		for (const file of files) {
			// todo
			// if (file.workspaceFolderPath === module.workspaceFolderPath) {
			// 	moduleObject.fileList.push(file);
			// }
		}
		fileModule.push(moduleObject);
	}
	return fileModule;
}