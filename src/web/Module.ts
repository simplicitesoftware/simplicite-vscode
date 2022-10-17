'use strict';

import { WorkspaceFolder, workspace, RelativePattern, Uri, Memento, commands, window } from 'vscode';
import { DevInfo } from './DevInfo';
import { File } from './File';
import { HashService } from './HashService';
import { ConflictAction } from './interfaces';
import { logger } from './log';

export class Module {
	moduleDevInfo: any;
	files: Map<string, File>;
	name: string;
	instanceUrl: string;
	globalState: Memento;
	conflictStatus: boolean;
	constructor(name: string, instanceUrl: string, globalState: Memento) {
		this.moduleDevInfo = undefined;
		this.files = new Map();
		this.name = name;
		this.instanceUrl = instanceUrl;
		this.globalState = globalState;
		this.conflictStatus = false;
	}

	private isStringInTemplate(uri: Uri, stringList: string[]) {
		for (const sl of stringList) {
			if(uri.path.includes(sl)) return true;
		}
		return false;
	}

	public setModuleDevInfo(moduleDevInfo: any, devInfo: DevInfo) {
		this.moduleDevInfo = moduleDevInfo;
		this.files.forEach((f: File) => {
			f.setInfoFromModuleDevInfo(moduleDevInfo, devInfo);
		});
	}

	// FILES
	async initFiles(app: any, globalState: Memento, workspaceFolderPath: string) {
		const getWk = (): WorkspaceFolder | undefined => {
			if (!workspace.workspaceFolders) return undefined;
			let returnWk = undefined;
			workspace.workspaceFolders.forEach(wk => {
				if (wk.uri.path === workspaceFolderPath) returnWk = wk;
			});
			return returnWk;
		};
		const wk = getWk();
		if (!wk) throw new Error('Cannot init files because module folder is not in workspace');
		const relativePattern = new RelativePattern(wk, '**/*');
		let files = await workspace.findFiles(relativePattern);
		files = files.filter((uri: Uri) => this.isStringInTemplate(uri, SUPPORTED_FILES)); // filter on accepted file extension
		files = files.filter((uri: Uri) => !this.isStringInTemplate(uri, EXCLUDED_FILES)); // some files need to be ignored (such as pom.xml, readme.md etc...)
		files.forEach((uri: Uri) => {
			const lowerCasePath = uri.path.toLowerCase();
			this.files.set(lowerCasePath, new File(uri, app, globalState));
		});
		await HashService.saveFilesHash(this.instanceUrl, this.name, Array.from(this.files.values()), this.globalState);
	}

	public getFileFromPath(uri: Uri): File | undefined {
		const lowerCasePath = uri.path.toLowerCase();
		return this.files.get(lowerCasePath);
	}

	public getFilesPathAsArray(): string[] {
		const files: string[] = [];
		this.files.forEach((file: File) => {
			files.push(file.uri.path);
		});
		return files;
	}

	public getTrackedFiles(): File[] {
		const fileList: File[] = [];
		this.files.forEach((file: File) => {
			if(file.getTrackedStatus()) fileList.push(file);
		});
		return fileList;
	}

	public async sendFiles() {
		const files = this.getTrackedFiles();
		files.forEach(async (file) => {
			HashService.checkForConflict(file, this.instanceUrl, this.name, this.globalState).then(async (res) => {
				if(res.action === ConflictAction.conflict && res.remoteContent) {
					await this.notifyAndSetConflict(file, res.remoteContent);
				} else if(res.action === ConflictAction.sendFile) {
					await file.sendFile(this.instanceUrl, this.name);
				} else if(res.action === ConflictAction.fetchRemote && res.remoteContent) {
					await workspace.fs.writeFile(file.uri, res.remoteContent);
					await HashService.updateFileHash(this.instanceUrl, this.name, file.uri, this.globalState);
				} else if(res.action === ConflictAction.nothing) {
					logger.info('No changes detected on ' + file.name);
				} else {
					logger.error('Unable to send file ' + file.name + '. Conflict action' + res.action);
				}
			});
		});
	}

	private async notifyAndSetConflict(file: File, remoteContent: Uint8Array) {
		const tempFile = Uri.file(STORAGE_PATH + 'remoteFile.java');
		await workspace.fs.writeFile(tempFile, remoteContent);
		await commands.executeCommand('vscode.diff', Uri.file(file.uri.path), tempFile);
		window.showWarningMessage('Simplicite: Conflict detected, click the following button to choose which file to override.', 'Choose action').then(async (click) => {
			if (click === 'Choose action') {
				const choice = await window.showQuickPick([{ label: 'Override remote content' }, { label: 'Override local content' }]);
				if (!choice) { 
					const msg = 'No file has been chosen';
					window.showInformationMessage('Simplicite: ' + msg);
					throw new Error(msg);
				} else if (choice.label === 'Override local content') { // write remote content on local
					await workspace.fs.writeFile(Uri.file(file.uri.path), remoteContent);
					await HashService.updateFileHash(this.instanceUrl, this.name, file.uri, this.globalState);
					await workspace.fs.delete(tempFile);
				} else if (choice.label === 'Override remote content') { // write local content on remote
					await file.sendFile(this.instanceUrl, this.name);
					await workspace.fs.delete(tempFile);
				}
			}
		});
	}
}