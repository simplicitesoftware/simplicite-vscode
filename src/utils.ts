'use strict';

import { Module } from './Module';

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

const supportedFiles = ['.java', '.css', '.less', '.js', '.html', '.md', '.xml', '.txt', '.yaml'];
const excludedFiles = ['BUILD', 'README', 'pom', '.min.', '/Theme/', '/docs/', '/files/', '/target/'];

export function validFileExtension(template: string): boolean {
	for (const extension of supportedFiles) {
		if (template.includes(extension) && checkExclude(template)) {
			return true;
		}
	}
	return false;
}

function checkExclude(template: string): boolean {
	for (const exclude of excludedFiles) {
		if (template.includes(exclude)) {
			return false;
		}
	}
	return true;
}

export function removeFileExtension(template: string): string {
	let fileName = template;
	for (const valid of supportedFiles) {
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