'use strict';

import { logger } from './Log';
import { Memento, RelativePattern, workspace } from 'vscode';
import { File } from './File';
import { Module } from './Module';
import { validFileExtension } from './utils';
import { SUPPORTED_FILES } from './constant';
import { FileTree } from './treeView/FileTree';
import { FileAndModule } from './interfaces';
import { getModuleFromWorkspacePath } from './utils';

interface ModuleObject {
	moduleName: string,
	instanceUrl: string,
	fileList: File[]
}

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

	deleteSimpliciteInfo(): void {
		this._globalState.update('simplicite-modules-info', undefined);
	}

	bindFileAndModule(modules: Array<Module>): FileAndModule[] {
		const fileModule = [];
		for (const module of modules) {
			if (module.remoteFileSystem) {
				continue;
			}
			const moduleObject: ModuleObject = { moduleName: module.name, instanceUrl: module.instanceUrl, fileList: [] };
			for (const file of this.fileList) {
				if (file.moduleName === module.name) {
					moduleObject.fileList.push(file);
				}
			}
			fileModule.push(moduleObject);
		}
		return fileModule;
	}

	private updateFileStatus() {
		const jsonContent = [];
		for (const file of this.fileList) {
			if (file.tracked) {
				jsonContent.push({ filePath: file.filePath, tracked: file.tracked });
			}
		}
		this._globalState.update('simplicite-files-info', jsonContent);
	}

	async FileDetector(modules: Module[]): Promise<File[]> {
		if (workspace.workspaceFolders === undefined) {
			throw new Error('no workspace detected');
		}
		const fileList = [];
		for (const workspaceFolder of workspace.workspaceFolders) {
			for (const valid of SUPPORTED_FILES) {
				const globPatern = '**/*' + valid;
				const relativePattern = new RelativePattern(workspaceFolder, globPatern);
				const files = await workspace.findFiles(relativePattern);
				for (const file of files) {
					if (validFileExtension(file.path) && !file.path.includes(workspaceFolder.name + '.xml') && !file.path.includes('/temp/')) {
						const module = getModuleFromWorkspacePath(workspaceFolder.uri.path, modules);
						if (!module || !file.path.includes(module.name)) {
							continue;
						}
						fileList.push(new File(file.path, module.instanceUrl, workspaceFolder.uri.path, module.name, false));
					}
				}
			}
		}
		try {
			if (this.fileTree) await this.fileTree.setFileModule(this.bindFileAndModule(modules));
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
					if (file.filePath === content.filePath) {
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

	async setTrackedStatus(filePath: string, status: boolean, fileModule: FileAndModule[]): Promise<void> {
		for (const file of this.fileList) {
			if (file.filePath.toLowerCase() === filePath.toLowerCase()) {
				file.tracked = status;
			}
		}
		this.updateFileStatus();
		if (this.fileTree) await this.fileTree.setFileModule(fileModule);
		Promise.resolve();
	}

	getFileFromFullPath(fullPath: string): File {
		for (const file of this.fileList) {
			let lowercasePath = file.filePath;
			lowercasePath = lowercasePath.toLowerCase();
			fullPath = fullPath.toLowerCase();
			if (lowercasePath === fullPath) {
				return file;
			}
		}
		return new File('', '', '', '', false);
	}
}
