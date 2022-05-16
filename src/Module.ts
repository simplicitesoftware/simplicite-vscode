'use strict';

import { WorkspaceFolder, workspace, RelativePattern, Uri, Memento } from 'vscode';
import { DevInfo } from './DevInfo';
import { File } from './File';
import { logger } from './Log';

export class Module {
	// remove name as it should be in map
	moduleDevInfo: any;
	workspaceFolderPath: string;
	files: Map<string, File>;
	constructor(workspaceFolderPath: string) {
		this.moduleDevInfo = undefined;
		this.workspaceFolderPath = workspaceFolderPath;
		this.files = new Map();
	}

	static async build(workspaceFolderPath: string, globalStorage: Memento, app: any) {
		const module = new Module(workspaceFolderPath);
		try {
			await module.initFiles(app, globalStorage);
		} catch(e) {
			logger.error(e);
		}
		return module;
	}

	private isStringInTemplate(uri: Uri, stringList: string[]) {
		for (const sl of stringList) {
			if(uri.path.includes(sl)) return true;
		}
		return false;
	}

	public async setModuleDevInfo(moduleDevInfo: any, devInfo: DevInfo) {
		this.moduleDevInfo = moduleDevInfo;
		this.files.forEach((f: File) => {
			f.setInfoFromModuleDevInfo(moduleDevInfo, devInfo);
		});
	}

	// FILES
	async initFiles(app: any, globalStorage: Memento) {
		const getWk = (): WorkspaceFolder | undefined => {
			if (!workspace.workspaceFolders) return undefined;
			let returnWk = undefined;
			workspace.workspaceFolders.forEach(wk => {
				if (wk.uri.path === this.workspaceFolderPath) returnWk = wk;
			});
			return returnWk;
		};
		const wk = getWk();
		if (!wk) throw new Error('Unexpected behavior. Cannot init files because module folder is not in workspace');
		const relativePattern = new RelativePattern(wk, '**/*');
		let files = await workspace.findFiles(relativePattern);
		files = files.filter((uri: Uri) => this.isStringInTemplate(uri, SUPPORTED_FILES)); // filter on accepted file extension
		files = files.filter((uri: Uri) => !this.isStringInTemplate(uri, EXCLUDED_FILES)); // some files need to be ignored (such as pom.xml, readme.md etc...)
		files.forEach((uri: Uri) => {
			const lowerCasePath = uri.path.toLowerCase();
			this.files.set(lowerCasePath, new File(uri, app, globalStorage));
		});
	}

	public getFileFromPath(uri: Uri): File | undefined {
		const lowerCasePath = uri.path.toLowerCase();
		return this.files.get(lowerCasePath);
	}

	public getFilesAsArray(): string[] {
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
}