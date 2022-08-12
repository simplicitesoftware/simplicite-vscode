'use strict';

import { url } from 'inspector';
import { workspace, TextDocument, Uri, TextDocumentChangeEvent } from 'vscode';
import { File } from './File';
import { FileInstance } from './interfaces';
import { logger } from './Log';
import { SimpliciteInstanceController } from './SimpliciteInstanceController';

// listens to saved files.
// compatible with the vscode feature save all
export class FileService {
	private modifiedFiles: Map<string, Map<string, File>>; // key = url, modified simplicité files associated with their instances
	private savedCpt: number; // not used when send on save option is disabled
	private simpliciteInstanceController: SimpliciteInstanceController;
	constructor (simpliciteInstanceController: SimpliciteInstanceController) {
		this.modifiedFiles = new Map();
		this.savedCpt = 0;
		this.simpliciteInstanceController = simpliciteInstanceController;
	}

	async fileListener() {
		// get a trace of simplicité modified files
		workspace.onDidChangeTextDocument((doc: TextDocumentChangeEvent) => {
			const fileUrl = this.simpliciteInstanceController.getFileAndInstanceUrlFromPath(doc.document.uri);
			if(!fileUrl) return;
			this.setModifiedFile(fileUrl);
		});

		// check if saved file is in trace of modified files
		workspace.onDidSaveTextDocument(this.onDidSaveTextDocument);
		
	}

	private async onDidSaveTextDocument(doc: TextDocument) {
		const file = this.getModifiedFile(doc.uri);
		if(!file) return;
		file.saveFileAsTracked();
		++this.savedCpt;
		if(this.savedCpt === this.countModifiedFiles()) { // if all files have been saved
			if(workspace.getConfiguration('simplicite-vscode-tools').get('api.sendFileOnSave')) await this.simpliciteInstanceController.sendAllFiles();
			this.savedCpt = 0;
			this.modifiedFiles = new Map();
		}
	}

	private setModifiedFile(fileUrl: FileInstance): void {
		const files = this.modifiedFiles.get(fileUrl.url);
		if(!files) {
			this.modifiedFiles.set(fileUrl.url, (new Map()).set(fileUrl.file.uri.path.toLowerCase(), fileUrl.file));
		} else {
			const path = fileUrl.file.uri.path;
			if(!files.has(path)) {
				files.set(path.toLowerCase(), fileUrl.file);
			}
		}
	}

	private getModifiedFile(uri: Uri): File | undefined {
		// loop on instances
		const value = this.modifiedFiles.values();
		for(const instance of value) {
			const file = instance.get(uri.path.toLowerCase());
			if(file) return file;
		}
		return undefined;
	}

	private countModifiedFiles(): number {
		let x = 0;
		const value = this.modifiedFiles.values();
		for(const instance of value) {
			x += instance.size;
		}
		return x;
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
}
