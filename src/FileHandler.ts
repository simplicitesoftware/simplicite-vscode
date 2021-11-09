'use strict';

import { logger } from './Log';
import { ExtensionContext, RelativePattern, workspace, WorkspaceFolder } from 'vscode';
import { File } from './File';
import { Module } from './Module';
import { crossPlatformPath, validFileExtension } from './utils';
import { SUPPORTED_FILES } from './constant';
import { parseStringPromise } from 'xml2js';
import { FileTree } from './treeView/FileTree';
import { FileAndModule } from './interfaces';
import { ModuleHandler } from './ModuleHandler';

interface ModuleObject {
	moduleName: string,
	instanceUrl: string,
	fileList: File[],
}

export class FileHandler {
	fileTree: FileTree;
	fileList: Array<File>;
	private _moduleHandler: ModuleHandler;
	private _context: ExtensionContext;
	constructor(fileTree: FileTree, moduleHandler: ModuleHandler, context: ExtensionContext) {
		this.fileTree = fileTree;
		this.fileList = [];
		this._moduleHandler = moduleHandler;
		this._context = context;
	}

	static async build(fileTree: FileTree, moduleHandler: ModuleHandler, context: ExtensionContext): Promise<FileHandler> {
		const fileHandler = new FileHandler(fileTree, moduleHandler, context);
		try {
			const modules = await fileHandler.getSimpliciteModules();
			const modulesToken = fileHandler.getTokenFromSimpliciteInfo(modules);
			moduleHandler.setModules(modulesToken, false); // need modules to create File
			fileHandler.fileList = await fileHandler.getFileOnStart();
			await fileHandler.fileTree.setFileModule(fileHandler.bindFileAndModule(moduleHandler.modules));
		} catch (e) {
			logger.error(e);
		}
		return fileHandler;
	}

	async simpliciteInfoGenerator(token: string, appURL: string): Promise<void> { // generates a JSON [{"projet": "...", "module": "...", "token": "..."}]
		let toBeWrittenJSON: Module[] = [];
		const simpliciteModules = await this.getSimpliciteModules();
		for (const module of simpliciteModules) {
			if (module.instanceUrl === appURL && !module.token) { // only set the token for the object coming from the same instance => same token 
				module.token = token;
				toBeWrittenJSON = toBeWrittenJSON.concat([module]);
			} else {
				toBeWrittenJSON = toBeWrittenJSON.concat([module]);
			}
		}
		toBeWrittenJSON = this.getTokenFromSimpliciteInfo(toBeWrittenJSON);
		this._context.globalState.update('simplicite-modules-info', toBeWrittenJSON);
	}

	private getTokenFromSimpliciteInfo(toBeWrittenJSON: Array<Module>) {
		try {
			const parsedJson: Array<Module> = this._context.globalState.get('simplicite-modules-info') || [];
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
		this._context.globalState.update('simplicite-modules-info', undefined);
	}

	deleteModule(instanceUrl: string | undefined, moduleName: string | undefined): void {
		const moduleArray: Module[] = this._context.globalState.get('simplicite-modules-info') || [];
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
		this._context.globalState.update('simplicite-modules-info', newInfo);
	}

	async getSimpliciteModules(): Promise<Module[]> { // returns array of module objects
		const modules = [];
		try {
			if (workspace.workspaceFolders === undefined) {
				throw new Error('No workspace detected');
			}
			for (const workspaceFolder of workspace.workspaceFolders) {
				const globPatern = '**/module-info.json'; // if it contains module-info.json -> simplicite module
				const relativePattern = new RelativePattern(workspaceFolder, globPatern);
				const modulePom = await workspace.findFiles(relativePattern);
				if (modulePom.length === 0) {
					throw new Error('No module found');
				}
				const instanceUrl = await this.getModuleInstanceUrl(workspaceFolder);
				if (modulePom[0]) {
					modules.push(new Module(workspaceFolder.name, crossPlatformPath(workspaceFolder.uri.path), instanceUrl, ''));
				}
			}
		} catch (e: any) {
			logger.warn(e);
		}
		return modules;
	}

	private async getModuleInstanceUrl(workspaceFolder: WorkspaceFolder): Promise<string | any> { // searches into pom.xml and returns the simplicite's instance url
		const globPatern = '**pom.xml';
		const relativePattern = new RelativePattern(workspaceFolder, globPatern);
		const file = await workspace.findFiles(relativePattern);
		if (file.length === 0) {
			throw new Error('No pom.xml has been found');
		}
		const pom = await (await workspace.openTextDocument(file[0])).getText();
		try {
			const res = await parseStringPromise(pom);
			return res.project.properties[0]['simplicite.url'][0];
		} catch (e) {
			logger.error(e);
		}
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
		this._context.globalState.update('simplicite-files-info', jsonContent);
	}

	fileListLength(): number {
		return this.fileList.length;
	}

	async getFileOnStart(): Promise<File[]> {
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
						fileList.push(new File(file.path, this._moduleHandler.getModuleUrlFromWorkspacePath(workspaceFolder.uri.path), workspaceFolder.uri.path, workspaceFolder.name, false));
					}
				}
			}
		}
		try {
			return this.setTrackedStatusPersistence(fileList);
		} catch (e) {
			logger.warn('getFileOnStart: ' + e);
			return fileList;
		}
	}

	private setTrackedStatusPersistence(fileList: File[]): File[] {
		try {
			const jsonContent: File[] = this._context.globalState.get('simplicite-files-info') || [];
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
		await this.fileTree.setFileModule(fileModule);
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
