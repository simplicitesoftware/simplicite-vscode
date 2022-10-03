'use strict';

import { workspace, TextDocument, Uri, TextDocumentChangeEvent } from 'vscode';
import { File } from './File';
import { FileInstance } from './interfaces';
import { SimpliciteInstanceController } from './SimpliciteInstanceController';

// listens to saved files.
// compatible with the vscode feature save all
export async function fileService(simpliciteInstanceController: SimpliciteInstanceController) {
	let modifiedFiles: Map<string, Map<string, File>> = new Map();; // key = url, modified simplicité files associated with their instances
	let savedCpt: number = 0; // not used when send on save option is disabled

	// get a trace of simplicité modified files
	workspace.onDidChangeTextDocument((doc: TextDocumentChangeEvent) => {
		const fileUrl = simpliciteInstanceController.getFileAndInstanceUrlFromPath(doc.document.uri);
		if(!fileUrl) return;
		setModifiedFile(fileUrl);
	});

	// check if saved file is in trace of modified files
	workspace.onDidSaveTextDocument(async (doc: TextDocument) => {
		const file = getModifiedFile(doc.uri);
		if(!file) return;
		await file.saveFileAsTracked();
		++savedCpt;
		if(savedCpt === countModifiedFiles()) { // if all files have been saved
			if(workspace.getConfiguration('simplicite-vscode-tools').get('api.sendFileOnSave')) await simpliciteInstanceController.sendAllFiles();
			savedCpt = 0;
			modifiedFiles = new Map();
		}
	});

	function setModifiedFile(fileUrl: FileInstance): void {
		const files = modifiedFiles.get(fileUrl.url);
		if(!files) {
			modifiedFiles.set(fileUrl.url, (new Map()).set(fileUrl.file.uri.path.toLowerCase(), fileUrl.file));
		} else {
			const path = fileUrl.file.uri.path;
			if(!files.has(path)) {
				files.set(path.toLowerCase(), fileUrl.file);
			}
		}
	}

	function getModifiedFile(uri: Uri): File | undefined {
		// loop on instances
		const value = modifiedFiles.values();
		for(const instance of value) {
			const file = instance.get(uri.path.toLowerCase());
			if(file) return file;
		}
		return undefined;
	}

	function countModifiedFiles(): number {
		let x = 0;
		const value = modifiedFiles.values();
		for(const instance of value) {
			x += instance.size;
		}
		return x;
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
