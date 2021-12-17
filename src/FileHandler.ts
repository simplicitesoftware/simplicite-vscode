'use strict';

import { logger } from './Log';
import { Memento, RelativePattern, workspace, Uri } from 'vscode';
import { File } from './File';
import { Module } from './Module';
import { validFileExtension } from './utils';
import { FileTree } from './treeView/FileTree';
import { getModuleFromWorkspacePath, replaceAll } from './utils';

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
				jsonContent.push({ path: file.uri.path, tracked: file.tracked });
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
					if (validFileExtension(file.path) && !file.path.includes(workspaceFolder.name + '.xml') && !file.path.includes('/.temp/')) {
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
					if (file.uri.path === content.uri.path) {
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

	async setTrackedStatus(fileUri: Uri, status: boolean, modules: Module[]): Promise<void> { // set the status true / false, and spread value to other objects
		for (const file of this.fileList) {
			let loopFileLowerCase = file.uri.path;
			loopFileLowerCase.toLowerCase();
			let paramFileLowerCase = fileUri.path;
			paramFileLowerCase.toLowerCase();
			if (loopFileLowerCase === paramFileLowerCase) {
				file.tracked = status;
			}
		}
		this.updateFileStatus();
		if (this.fileTree) await this.fileTree.setFileModule(modules, this.fileList);
	}

	setApiFileInfo(file: File, devInfo: any) {
		if (!file.type && !file.scriptField && !file.fieldName) { // set the values only once
			file.type = this.getBusinessObjectType(file.uri.path, devInfo);
			file.scriptField = this.getProperScriptField(file.type, devInfo);
			file.fieldName = this.getProperNameField(file.type, devInfo);
		}
	}

	private getProperNameField(fileType: string, devInfo: any) {
		for (const object of devInfo.objects) {
			if (fileType === object.object) {
				return object.keyfield;
			}
		}
	}

	private getProperScriptField(fileType: string, devInfo: any) {
		for (const object of devInfo.objects) {
			if (fileType === object.object) {
				return object.sourcefield;
			}
		}
	}

	private getBusinessObjectType(filePath: string, devInfo: any): string {
		for (const object of devInfo.objects) {
			if (object.package) {
				const comparePackage = replaceAll(object.package, /\./, '/');
				if (filePath.includes(comparePackage)) {
					return object.object;
				}
			}
		}
		if (filePath.includes('/resources/')) { // programatically handling packages that are not in devInfo
			return 'Resource';
		} else if (filePath.includes('/test/src/com/simplicite/')) {
			return 'Script';
		} else if (filePath.includes('/scripts/')) {
			return 'Disposition';
		} else {
			throw new Error('No type has been found');
		}
	}

	getFileFromFullPath(fullPath: string): File {
		for (const file of this.fileList) {
			let lowercasePath = file.uri.path;
			lowercasePath = lowercasePath.toLowerCase();
			fullPath = fullPath.toLowerCase();
			if (lowercasePath === fullPath) {
				return file;
			}
		}
		return new File('', '', '', '', false);
	}

	static async getContent(fileUri: Uri): Promise<Uint8Array> { // todo
		const content = await workspace.fs.readFile(fileUri);
		//const fileContent = FileHandler.getContentFromModuleFile(fileContentList, module); // usefull if same module is in workspace as Api file system (written on disk) AND as module
		//const document = await workspace.openTextDocument(fileContent);
		//const text = document.getText();
		return content;
	}

	private static getContentFromModuleFile (fileContentList: any, module: Module): any { // to do
		if (!fileContentList) {
			return undefined;
		}
		for (const fileContent of fileContentList) {
			if (fileContent.path.includes('Api_') && module.apiFileSystem) { // get Api file
				return fileContent;
			} else if (fileContent.path.includes(module.name) && !fileContent.path.includes('Api_') && !module.apiFileSystem) { // get content 
				return fileContent;
			}
		}
	}
}
