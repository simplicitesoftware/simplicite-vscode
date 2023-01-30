'use strict';

import { WorkspaceFolder, workspace, RelativePattern, Uri, Memento, commands, window } from 'vscode';
import { DevInfo } from './DevInfo';
import { CustomFile } from './CustomFile';
import { HashService } from './HashService';
import { ConflictAction } from './interfaces';

export class Module {
	moduleDevInfo: any;
	files: Map<string, CustomFile>;
	name: string;
	instanceUrl: string;
	globalState: Memento;
	conflictStatus: boolean;
	subModules: Map<string, Module>;
	constructor(name: string, instanceUrl: string, globalState: Memento) {
		this.moduleDevInfo = undefined;
		this.files = new Map();
		this.name = name;
		this.instanceUrl = instanceUrl;
		this.globalState = globalState;
		this.conflictStatus = false;
		this.subModules = new Map();
	}

	static async build(name: string, instanceUrl: string, globalState: Memento, app: any, wkUri: Uri, ignoredModules: string[]): Promise<Module> {
		const module = new Module(name, instanceUrl, globalState);
		await module.initFiles(app, globalState, wkUri, ignoredModules);
		return module;
	}

	private isStringInTemplate(uri: Uri, stringList: string[]) {
		for (const sl of stringList) {
			if(uri.path.includes(sl)) return true;
		}
		return false;
	}

	public async setModuleDevInfo(devInfo: DevInfo, app: any) {
		this.moduleDevInfo = await this.getModuleDevInfo(app);
		// get subModules module dev info
		for(const sMod of this.subModules.values()) {
			await sMod.setModuleDevInfo(devInfo, app);
		}
		this.files.forEach((f: CustomFile) => {
			f.setInfoFromModuleDevInfo(this.moduleDevInfo, devInfo);
		});
	}

	private async getModuleDevInfo(app: any) {
		try {
			const moduleDevInfo = await app.getDevInfo(this.name);
			return moduleDevInfo;
		} catch(e: any) {
			throw new Error(e);
		}
	}

	// FILES
	async initFiles(app: any, globalState: Memento, wkUri: Uri, ignoredModules: string[]) {
		const relativePattern = new RelativePattern(wkUri, '**/*');
		let files: Uri[] = []; 
		if(ignoredModules.length) {
			const excludePattern = this.generateExcludePattern(wkUri, ignoredModules);
			files = await workspace.findFiles(relativePattern, excludePattern);
		} else {
			files = await workspace.findFiles(relativePattern);
		}
		files = files.filter((uri: Uri) => this.isStringInTemplate(uri, SUPPORTED_FILES)); // filter on accepted file extension
		files = files.filter((uri: Uri) => !this.isStringInTemplate(uri, EXCLUDED_FILES)); // some files need to be ignored (such as pom.xml, readme.md etc...)
		files.forEach((uri: Uri) => {
			const lowerCasePath = uri.path.toLowerCase();
			this.files.set(lowerCasePath, new CustomFile(uri, app, globalState));
		});
		await HashService.saveFilesHash(this.instanceUrl, this.name, Array.from(this.files.values()), this.globalState);
		console.log(`Initialized ${this.files.size} files for module ${this.name}`);
	}

	private generateExcludePattern(wkUri: Uri, ignoredModules: string[]): RelativePattern {
		let patternString = '**/{';
		for(let i = 0; i < ignoredModules.length; i++) {
			patternString += `${ignoredModules[i]}`;
			if(i !== ignoredModules.length - 1) patternString += ',';
		}
		patternString += '}/**';
		return new RelativePattern(wkUri, patternString);
	}

	private getFileFromUri(uri: Uri): CustomFile | undefined {
		const lowerCasePath = uri.path.toLowerCase();
		return this.files.get(lowerCasePath);
	}

	public getFileFromUriRecursive(fileUri: Uri): CustomFile | undefined {
		let file = this.getFileFromUri(fileUri);
		if(!file) {
			for(const sub of this.subModules.values()) {
				file = sub.getFileFromUriRecursive(fileUri);
				if(file) return file;
			}
		}
		return file;
	}

	public getFilesPathAsArray(): string[] {
		const files: string[] = [];
		this.files.forEach((file: CustomFile) => {
			files.push(file.uri.path);
		});
		return files;
	}

	public getTrackedFiles(): CustomFile[] {
		const fileList: CustomFile[] = [];
		this.files.forEach((file: CustomFile) => {
			if(file.getTrackedStatus()) fileList.push(file);
		});
		return fileList;
	}

	public async sendFiles(): Promise<void> {
		const trackedFiles = this.getTrackedFiles();
		if(trackedFiles.length) {
			console.log('Module ' + this.name + ' sending files');
			await this.sendFilesPromise(trackedFiles);
		}
		await this.sendSubModulesPromise();
	}

	private async sendFilesPromise(files: CustomFile[]) {
		const promises = [];
		for(const file of files) {
			promises.push(this.fileAction(file));
		}
		return await Promise.all(promises);
	}

	private async fileAction(file: CustomFile) {
		const res = await HashService.checkForConflict(file, this.instanceUrl, this.name, this.globalState);
		if(res.action === ConflictAction.conflict && res.remoteContent) {
			await this.notifyAndSetConflict(file, res.remoteContent);
		} else if(res.action === ConflictAction.sendFile) {
			await file.sendFile(this.instanceUrl, this.name);
		} else if(res.action === ConflictAction.fetchRemote && res.remoteContent) {
			await workspace.fs.writeFile(file.uri, res.remoteContent);
			await HashService.updateFileHash(this.instanceUrl, this.name, file.uri, this.globalState);
		} else if(res.action === ConflictAction.nothing) {
			console.log('No changes detected on ' + file.name);
		} else {
			console.error('Unable to send file ' + file.name + '. Conflict action' + res.action);
		}
	}

	private async sendSubModulesPromise() {
		const promises = [];
		const sendModule = async function(mod: Module) {
			await mod.sendFiles();
		}; 
		for(const mod of this.subModules.values()) {
			promises.push(sendModule(mod));
		}
		return await Promise.all(promises);
	}

	private async notifyAndSetConflict(file: CustomFile, remoteContent: Uint8Array) {
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