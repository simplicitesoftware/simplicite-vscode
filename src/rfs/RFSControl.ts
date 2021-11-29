'use strict';

import { workspace, Uri, commands } from 'vscode';
import { DevInfoObject } from '../interfaces';
import { logger } from '../Log';
import { Module } from '../Module';
import { ModuleHandler } from '../ModuleHandler';
import { replaceAll } from '../utils';
import { Buffer } from 'buffer';
import { File } from '../File';

export class RFSControl {
	app: any;
	baseUrl: string;
	module: Module;
	devInfo: DevInfoObject;

	constructor (app: any, module: Module, devInfo: DevInfoObject) {
		this.app = app;
		this.module = module;
		this.devInfo = devInfo;
		this.baseUrl = 'Api_' + module.name;
	}

	async initAll(moduleHandler: ModuleHandler) {
		try {
			const wk = this.getWorkspaceFolderPath(this.module);
			if (wk) {
				this.module.workspaceFolderPath = wk;
			}
			for (let mod of moduleHandler.modules) {
				if (mod.name === this.module.name) {
					mod = this.module;
				}
			}
			moduleHandler.saveModules();
			await this.initFiles();
			commands.executeCommand('simplicite-vscode-tools.initApiWorkspace', 'Api_' + this.module.name);
		} catch (e) {
			logger.error(e);
		}
		
	}

	async initFiles(): Promise<boolean> {
		if (!this.module) {
			return false;
		}
		try {
			const uri = Uri.parse(this.baseUrl);
			workspace.fs.createDirectory(uri);
			const mdl = await this.app.getBusinessObject('Module');
			const ms = await mdl.search({ mdl_name: this.module.name} );
			const m = ms[0];
			await this.getAllFiles(m.row_id);
			const pom = await mdl.print('Module-MavenModule', m.row_id);
			workspace.fs.writeFile(Uri.parse(this.baseUrl + '/pom.xml'), Buffer.from(pom.content, 'base64'));
			return true;
		} catch (e) {
			logger.error(e);
			return false;
		}
	}

	async getAllFiles (mdl_id: string): Promise<any> {
		if (!this.devInfo) {
			return false;
		}
		for (const devObj of this.devInfo.objects) {
			if (!devObj.package) {
				continue;
			}
			const obj = this.app.getBusinessObject(devObj.object, 'ide_' + devObj.object);
			const res = await obj.search({ row_module_id: mdl_id }, { inlineDocuments: [ true ] });
			if (!res || res.length === 0) {
				continue;
			}
			const replace = 'src/' + replaceAll(devObj.package, /\./, '/');
			this.createFolderTree(replace);
			
			for (const object of res) {
				if (!object[devObj.sourcefield]) {
					continue;
				}
				let uri = Uri.parse(this.baseUrl + '/temp/' + object[devObj.sourcefield].name);
				workspace.fs.writeFile(uri, Buffer.from(object[devObj.sourcefield].content, 'base64'));
				uri = Uri.parse(this.baseUrl + '/' + replace + '/' + this.module.name + '/' + object[devObj.sourcefield].name);
				workspace.fs.writeFile(uri, Buffer.from(object[devObj.sourcefield].content, 'base64'));
			}
		}
	}

	createFolderTree (folderPath: string) {
		const split = folderPath.split('/');
		if (split[split.length - 1] === 'dispositions') {
			let path = this.baseUrl + '/scripts';
			workspace.fs.createDirectory(Uri.parse(path));
			path += '/Disposition';
			workspace.fs.createDirectory(Uri.parse(path));
		} else {
			let path = this.baseUrl + '/src/com/simplicite/' + split[split.length - 1];
			workspace.fs.createDirectory(Uri.parse(path));
			path += '/' + this.module.name;
			workspace.fs.createDirectory(Uri.parse(path));
		}
	}

	getWorkspaceFolderPath(module: Module): string | false {
		if (!workspace.workspaceFolders) {
			return false;
		}
		for (const wk of workspace.workspaceFolders) {
			if (wk.name ===  'Api_' + module.name) {
				return wk.uri.path;
			}
		}
		return false;
	}
}