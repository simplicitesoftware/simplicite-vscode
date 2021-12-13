'use strict';

import { logger } from './Log';
import { Memento, RelativePattern, workspace } from 'vscode';
import { File } from './File';
import { Module } from './Module';
import { validFileExtension } from './utils';
import { SUPPORTED_FILES } from './constant';
import { FileTree } from './treeView/FileTree';
import { getModuleFromWorkspacePath } from './utils';

export class FileHandler {
	fileTree?: FileTree;
	fileList: Array<File>;
	private _globalState: Memento;
	constructor(globalState: Memento) {
		this.fileList = [];
		this._globalState = globalState;
	}

	static async build(globalState: Memento, modules: Module[]): Promise<FileHandler> {
		const fileHandler = new FileHandler(globalState);
		try {
			fileHandler.fileList = await fileHandler.FileDetector(modules);
		} catch (e) {
			logger.error(e);
		}
		return fileHandler;
	}

	private updateFileStatus() {
		const jsonContent = [];
		for (const file of this.fileList) {
			if (file.tracked) {
				jsonContent.push({ path: file.path, tracked: file.tracked });
			}
		}
		this._globalState.update('simplicite-files-info', jsonContent);
	}

	async FileDetector(modules: Module[]): Promise<File[]> {
		this.fileList = [];
		if (workspace.workspaceFolders === undefined) {
			throw new Error('no workspace detected');
		}
		const fileList = [];
		const wks = workspace.workspaceFolders;
		for (const workspaceFolder of wks) {
			for (const valid of SUPPORTED_FILES) {
				const globPatern = '**/*' + valid;
				const relativePattern = new RelativePattern(workspaceFolder, globPatern);
				const files = await workspace.findFiles(relativePattern);
				for (const file of files) {
					if (validFileExtension(file.path) && !file.path.includes(workspaceFolder.name + '.xml') && !file.path.includes('/temp/')) {
						const module = getModuleFromWorkspacePath(workspaceFolder.uri.path, modules);
						const wk = workspaceFolder.uri.path.toLowerCase();
						let filePath = file.path;
						filePath = filePath.toLowerCase();
						const test = !filePath.includes(wk);
						if (!module || test) {
							continue;
						}
						fileList.push(new File(file.path, module.instanceUrl, workspaceFolder.uri.path, module.parentFolderName, false));
					}
				}
			}
		}
		try {
			if (this.fileTree) await this.fileTree.setFileModule(modules, fileList);
			return this.setTrackedStatusPersistence(fileList);
		} catch (e) {
			logger.warn('File Detector: ' + e);
			return fileList;
		}
	}

	private setTrackedStatusPersistence(fileList: File[]): File[] {
		try {
			const jsonContent: File[] = this._globalState.get('simplicite-files-info') || [];
			for (const file of fileList) {
				for (const content of jsonContent) {
					if (file.path === content.path) {
						file.tracked = content.tracked;
						break;
					}
				}
			}
		} catch (e: any) {
			throw new Error(e.message);
		}
		return fileList;
	}

	async setTrackedStatus(filePath: string, status: boolean, modules: Module[]): Promise<void> {
		for (const file of this.fileList) {
			if (file.path.toLowerCase() === filePath.toLowerCase()) {
				file.tracked = status;
			}
		}
		this.updateFileStatus();
		if (this.fileTree) await this.fileTree.setFileModule(modules, this.fileList);
	}

	getFileFromFullPath(fullPath: string): File {
		for (const file of this.fileList) {
			let lowercasePath = file.path;
			lowercasePath = lowercasePath.toLowerCase();
			fullPath = fullPath.toLowerCase();
			if (lowercasePath === fullPath) {
				return file;
			}
		}
		return new File('', '', '', '', false);
	}
}
