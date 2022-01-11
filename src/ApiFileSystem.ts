'use strict';

import { workspace, Uri } from 'vscode';
import { DevInfo } from './DevInfo';
import { logger } from './Log';
import { Module } from './Module';
import { ModuleHandler } from './ModuleHandler';
import { replaceAll } from './utils';
import { Buffer } from 'buffer';

export class ApiFileSystem {
	private _app: any;
	private _baseUrl: string;
	private _devInfo: DevInfo;
	module: Module; // not private because need to access in extension.ts
	constructor (app: any, module: Module, devInfo: DevInfo) {
		this._app = app;
		this.module = module;
		this._devInfo = devInfo;
		this._baseUrl = STORAGE_PATH + module.parentFolderName;
	}

	async initApiFileSystemModule(moduleHandler: ModuleHandler) {
		if (this.module.instanceJump) {
			// need to save the module => updating the first workspace folder implies that all extensions are restarted by VS Code
			this.module.instanceJump = false;
			moduleHandler.addModule(this.module, false);
		}
		try {
			const uri = Uri.file(STORAGE_PATH + 'Api_' + this.module.name);
			try { // if directory does not exist or is empty then initFiles
				const res = await workspace.fs.readDirectory(uri);
				if (res.length === 0) throw new Error();
			} catch (e) {
				await this.initFiles();
			}
			const wks = workspace.workspaceFolders;
			let flag = false;
			if (wks) {
				for (const wk of wks) {
					if (wk.name === this._baseUrl) {
						flag = true;
					}
				}
			}
			if (!flag) {
			// create the workspace only once, extension will reload
				workspace.updateWorkspaceFolders(0, 0, { uri: Uri.parse(STORAGE_PATH + 'Api_' + this.module.name), name: 'Api_' + this.module.name });
			}
		} catch (e) {
			logger.error(e);
		}
	}

	async initFiles(): Promise<boolean> {
		if (!this.module) {
			return false;
		}
		try {
			const uri = Uri.parse(STORAGE_PATH + 'Api_' + this.module.name);
			await workspace.fs.createDirectory(uri);
			const mdl = await this._app.getBusinessObject('Module');
			// look for module row_id
			const ms = await mdl.search({ mdl_name: this.module.name} );
			const m = ms[0];
			await this.getAllFiles(m.row_id);
			// pom.xml
			const pom = await mdl.print('Module-MavenModule', m.row_id);
			await workspace.fs.writeFile(Uri.file(STORAGE_PATH + 'Api_' + this.module.name + '/pom.xml'), Buffer.from(pom.content, 'base64'));
			return true;
		} catch (e) {
			logger.error(e);
			return false;
		}
	}

	async getAllFiles (mdl_id: string): Promise<any> {
		if (!this._devInfo) {
			return false;
		}
		for (const devObj of this._devInfo.objects) {
			if (!devObj.package) continue;
			const obj = this._app.getBusinessObject(devObj.object, 'ide_' + devObj.object);
			// get every object from module row_id
			const res = await obj.search({ row_module_id: mdl_id }, { inlineDocuments: [ true ] });
			if (!res || res.length === 0) continue;
			const replace = 'src/' + replaceAll(devObj.package, /\./, '/'); // convert package into path and prefix with src
			this.createFolderTree(replace);
			for (const object of res) {
				if (!object[devObj.sourcefield]) continue; // -> no script
				const uri = Uri.file(STORAGE_PATH + 'Api_' + this.module.name + '/' + replace + '/' + this.module.name + '/' + object[devObj.sourcefield].name);
				workspace.fs.writeFile(uri, Buffer.from(object[devObj.sourcefield].content, 'base64'));
			}
		}
	}

	createFolderTree (folderPath: string) {
		const split = folderPath.split('/');
		if (split[split.length - 1] === 'dispositions') {
			let path = STORAGE_PATH + 'Api_' + this.module.name + '/scripts';
			workspace.fs.createDirectory(Uri.file(path));
			path += '/Disposition';
			workspace.fs.createDirectory(Uri.file(path));
		} else {
			let path = STORAGE_PATH + 'Api_' + this.module.name + '/src/com/simplicite/' + split[split.length - 1];
			workspace.fs.createDirectory(Uri.file(path));
			path += '/' + this.module.name;
			workspace.fs.createDirectory(Uri.file(path));
		}
	}
}