'use strict';

import { WorkspaceFolder, workspace, RelativePattern, Uri } from 'vscode';
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

	static async build(workspaceFolderPath: string) {
		const module = new Module(workspaceFolderPath);
		try {
			await module.initFiles();
		} catch(e) {
			logger.error(e);
		}
		return module;
	}

	async initFiles() {
		const getWk = (): WorkspaceFolder | undefined => {
			if (!workspace.workspaceFolders) return undefined;
			let returnWk = undefined;
			workspace.workspaceFolders.forEach(wk => {
				if (wk.uri.path === this.workspaceFolderPath) returnWk = wk;
			});
			return returnWk;
		}
		const wk = getWk();
		if (!wk) throw new Error('Unexpected behavior. Cannot init files because module folder is not in workspace');
		const relativePattern = new RelativePattern(wk, '**/*');
		let files = await workspace.findFiles(relativePattern);
		files = files.filter((uri: Uri) => this.isStringInTemplate(uri, SUPPORTED_FILES)); // filter on accepted file extension
		files = files.filter((uri: Uri) => !this.isStringInTemplate(uri, EXCLUDED_FILES)) // some files need to be ignored (such as pom.xml, readme.md etc...)
		files.forEach((uri: Uri) => {
			this.files.set(uri.path.toLowerCase(), new File(uri, false));
		})
	}

	private isStringInTemplate(uri: Uri, stringList: string[]) {
		for (const sl of stringList) {
			if(uri.path.includes(sl)) return true;
		}
		return false;
	}

	public setFileStatus(uri: Uri, isTracked: boolean) {
		const file = this.files.get(uri.path);
		if(file) file.tracked = isTracked;
	}

	public getFileFromPath(uri: Uri): File | undefined {
		return this.files.get(uri.path.toLowerCase());
	}
}