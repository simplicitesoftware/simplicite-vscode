'use strict';

import { workspace, TextDocument, Uri } from 'vscode';
import { File } from './File';
import { logger } from './Log';
import { SimpliciteInstanceController } from './SimpliciteInstanceController';

export class FileService {
	lastDetectedSave: number;
	files: Map<string, File[]>; // files to be sent, key = url, usefull to send file from same instance in same process
	firstElement: boolean;
	simpliciteInstanceController: SimpliciteInstanceController;
	constructor (simpliciteInstanceController: SimpliciteInstanceController) {
		this.lastDetectedSave = 0;
		this.files = new Map();
		this.firstElement = true;
		this.simpliciteInstanceController = simpliciteInstanceController;
	}

	public static async build(simpliciteInstanceController: SimpliciteInstanceController): Promise<FileService> {
		const fileService = new FileService(simpliciteInstanceController);
		await fileService.fileListener();
		return fileService;
	}

	// ignore right files
	public async fileListener() {
		workspace.onDidSaveTextDocument(async (doc: TextDocument) => {
			if (this.firstElement || Date.now() - this.lastDetectedSave < 500) { // intervalle < 500ms
				this.addFile(doc.uri);
				this.firstElement = false;
				this.lastDetectedSave = Date.now();
			}
			setTimeout(this.isSaveTheLast.bind(this), 1000);

			// console.log('did save ' + doc.uri.path);
			// const fileInstance = simpliciteInstanceController.getFileAndInstanceFromPath(doc.uri);
			// if (!fileInstance) {
			// 	logger.error('Detected save on document but could not retrieve the correspondant file');
			// 	return;
			// }
		});
	}

	private async isSaveTheLast() {
		const delta = Date.now() - this.lastDetectedSave;
		if (delta >= 1000 && !this.firstElement) {
			this.firstElement = true;
			await this.sendFiles();
			this.files = new Map();
		}
	}

	// loop on map.
	private async sendFiles() {
		this.files.forEach(async (f: File[], key: string) => {
			await this.simpliciteInstanceController.sendFiles(f, key);
		});
	}

	private addFile(uri: Uri) {
		const fileInstance = this.simpliciteInstanceController.getFileAndInstanceUrlFromPath(uri);
		if (!fileInstance) {
			logger.error(uri.path + ' is probably not a Simplicité file');
			return;
		}
		if(!this.files.has(fileInstance.url)) this.files.set(fileInstance.url, [fileInstance.file]);
		else {
			let values = this.files.get(fileInstance.url);
			values ? values.push(fileInstance.file) : values = [fileInstance.file];
			this.files.set(fileInstance.url, values);
		}
	}

	// 	// create temp folder and copy files to store the initial state of a file (for conflict resolution)
	// 	async initTempFolder(fileModule: FileAndModule[]) {
	// 		try {
	// 			for (const fm of fileModule) {
	// 				const modulePath = STORAGE_PATH + 'temp/' + fm.module.name + '/';
	// 				await workspace.fs.createDirectory(Uri.parse(modulePath));
	// 				for (const file of fm.fileList) {
	// 					const tempFilePath = File.tempPathMaker(file);
	// 					const localFileContent = await File.getContent(file.uri);
	// 					if (!localFileContent) {
	// 						throw new Error('Cannot get content from ' + file.uri.path);
	// 					}
	// 					await workspace.fs.writeFile(Uri.file(tempFilePath), localFileContent);
	// 				}
	// 			}
	// 		} catch(e) {
	// 			logger.warn(e);
	// 		}
	// 	}
	
	// 	private updateFileStatus() {
	// 		const jsonContent = [];
	// 		for (const file of this.fileList) {
	// 			if (file.tracked) {
	// 				jsonContent.push({ path: file.uri.path, tracked: file.tracked });
	// 			}
	// 		}
	// 		this._globalState.update('simplicite-files-info', jsonContent);
	// 	}
	
	// 	async FileDetector(moduleHandler: ModuleHandler): Promise<File[]> {
	// 		this.fileList = [];
	// 		if (workspace.workspaceFolders === undefined) {
	// 			throw new Error('no workspace detected');
	// 		}
	// 		const fileList = [];
	// 		const wks = workspace.workspaceFolders;
	// 		for (const workspaceFolder of wks) {
	// 			for (const valid of SUPPORTED_FILES) {
	// 				const globPatern = '**/*' + valid;
	// 				const relativePattern = new RelativePattern(workspaceFolder, globPatern);
	// 				const files = await workspace.findFiles(relativePattern);
	// 				for (const file of files) {
	// 					if (validFileExtension(file.path) && !file.path.includes(workspaceFolder.name + '.xml') && !file.path.includes('/.temp/')) {
	// 						const module = moduleHandler.getModuleFromWorkspacePath(workspaceFolder.uri.path);
	// 						const wk = workspaceFolder.uri.path.toLowerCase();
	// 						let filePath = file.path;
	// 						filePath = filePath.toLowerCase();
	// 						const test = !filePath.includes(wk);
	// 						if (!module || test) {
	// 							continue;
	// 						}
	// 						fileList.push(new File(file.path, module.instanceUrl, workspaceFolder.uri.path, module.name, false));
	// 					}
	// 				}
	// 			}
	// 		}
	// 		try {
	// 			if (this.fileTree) await this.fileTree.setFileModule(moduleHandler.modules, fileList);
	// 			return this.setTrackedStatusPersistence(fileList);
	// 		} catch (e) {
	// 			logger.warn('File Detector: ' + e);
	// 			return fileList;
	// 		}
	// 	}
	
	// 	private setTrackedStatusPersistence(fileList: File[]): File[] {
	// 		try {
	// 			const jsonContent: any[] = this._globalState.get('simplicite-files-info') || [];
	// 			for (const file of fileList) {
	// 				for (const content of jsonContent) {
	// 					if (file.uri.path === content.path) {
	// 						file.tracked = content.tracked;
	// 						break;
	// 					}
	// 				}
	// 			}
	// 		} catch (e: any) {
	// 			throw new Error(e.message);
	// 		}
	// 		return fileList;
	// 	}
	
	// 	async setTrackedStatus(fileUri: Uri, status: boolean, modules: Module[]): Promise<void> { // set the status true / false, and spread value to other objects
	// 		for (const file of this.fileList) {
	// 			const loopFileLowerCase = file.uri.path;
	// 			loopFileLowerCase.toLowerCase();
	// 			const paramFileLowerCase = fileUri.path;
	// 			paramFileLowerCase.toLowerCase();
	// 			if (loopFileLowerCase === paramFileLowerCase) {
	// 				file.tracked = status;
	// 			}
	// 		}
	// 		this.updateFileStatus();
	// 		if (this.fileTree) await this.fileTree.setFileModule(modules, this.fileList);
	// 	}
	
	// 	setFilesModuleDevInfo(mod: Module, devInfo: DevInfo) {
	// 		for (const file of this.fileList) {
	// 			if (file.simpliciteUrl !== mod.instanceUrl) continue;
	// 			file.setModuleDevInfo(mod.moduleDevInfo, devInfo);
	// 		}
	// 	}
	
	// 	getFileFromFullPath(fullPath: string): File {
	// 		for (const file of this.fileList) {
	// 			let lowercasePath = file.uri.path;
	// 			lowercasePath = lowercasePath.toLowerCase();
	// 			fullPath = fullPath.toLowerCase();
	// 			if (lowercasePath === fullPath) {
	// 				return file;
	// 			}
	// 		}
	// 		return new File('', '', '', '', false);
	// 	}
}
