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
	fileList: File[],
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

	async simpliciteInfoGenerator(token: string, appURL: string, modules: Module[]): Promise<void> { // generates a JSON [{"projet": "...", "module": "...", "token": "..."}]
		let toBeWrittenJSON: Module[] = [];
		for (const module of modules) {
			if (module.instanceUrl === appURL && !module.token) { // only set the token for the object coming from the same instance => same token 
				module.token = token;
				toBeWrittenJSON = toBeWrittenJSON.concat([module]);
			} else {
				toBeWrittenJSON = toBeWrittenJSON.concat([module]);
			}
		}
		toBeWrittenJSON = this.getTokenFromSimpliciteInfo(toBeWrittenJSON);
		this._globalState.update('simplicite-modules-info', toBeWrittenJSON);
	}

	private getTokenFromSimpliciteInfo(toBeWrittenJSON: Array<Module>) {
		try {
			const parsedJson: Array<Module> = this._globalState.get('simplicite-modules-info') || [];
			if (parsedJson.length === 0 || parsedJson === undefined) {
				throw new Error('Cannot get token. No simplicite info content found');
			}
			parsedJson.forEach((module: Module) => {
				toBeWrittenJSON.forEach((preparedModule: Module) => {
					if (preparedModule.name === module.name && module.token && preparedModule.token === '') {
						preparedModule.token = module.token;
					}
				});
			});
			return toBeWrittenJSON;
		} catch (e: any) {
			logger.info(e);
		}
		return toBeWrittenJSON;
	}

	deleteSimpliciteInfo(): void {
		this._globalState.update('simplicite-modules-info', undefined);
	}

	deleteModule(instanceUrl: string | undefined, moduleName: string | undefined): void {
		const moduleArray: Module[] = this._globalState.get('simplicite-modules-info') || [];
		const newInfo = [];
		if (moduleArray === null) {
			throw new Error('Error getting simplicite info content');
		}
		for (const module of moduleArray) {
			if (instanceUrl) {
				if (module.instanceUrl !== instanceUrl) {
					newInfo.push(module);
				}
			} else if (moduleName) {
				if (module.name !== moduleName) {
					newInfo.push(module);
				}
			}
		}
		this._globalState.update('simplicite-modules-info', newInfo);
	}

	bindFileAndModule(modules: Array<Module>): FileAndModule[] {
		const fileModule = [];
		for (const module of modules) {
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
					if (validFileExtension(file.path) && !file.path.includes(workspaceFolder.name + '.xml')) {
						const module = getModuleFromWorkspacePath(workspaceFolder.uri.path, modules);
						if (!module) {
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
			const lowercasePath = file.filePath;
			if (lowercasePath.toLowerCase() === fullPath.toLowerCase()) {
				return file;
			}
		}
		return new File('', '', '', '', false);
	}
}
