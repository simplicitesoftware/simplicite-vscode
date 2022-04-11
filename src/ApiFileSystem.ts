'use strict';

import { workspace, Uri } from 'vscode';
import { logger } from './Log';
import { ApiModule } from './ApiModule';
import { ModuleHandler } from './ModuleHandler';
import { Buffer } from 'buffer';
import { SimpliciteApi } from './SimpliciteApi';

export class ApiFileSystem {
	private _app: any;
	private _baseUrl: string;
	private _simpliciteApi: SimpliciteApi;
	module: ApiModule; // not private because need to access in extension.ts
	constructor (app: any, module: ApiModule, simpliciteApi: SimpliciteApi) {
		this._app = app;
		this._baseUrl = STORAGE_PATH; //+ module.parentFolderName; todo
		this.module = module;
		this._simpliciteApi = simpliciteApi;
	}

	async initApiFileSystemModule(moduleHandler: ModuleHandler) {
		if (this.module.instanceJump) {
			// need to save the module => updating the first workspace folder implies that all extensions are restarted by VS Code
			this.module.instanceJump = false;
			moduleHandler.addModule(this.module, false);
		}
		try {
			const uri = Uri.file(STORAGE_PATH + this.module.apiModuleName);
			try { // if directory does not exist or is empty then initFiles
				const res = await workspace.fs.readDirectory(uri);
				if (res.length === 0) throw new Error();
			} catch (e) {
				await this.createProject();
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
				workspace.updateWorkspaceFolders(0, 0, { uri: Uri.parse(STORAGE_PATH + this.module.apiModuleName), name: this.module.apiModuleName });
			}
		} catch (e) {
			logger.error(e);
		}
	}

	async createProject(): Promise<boolean> {
		if (!this.module) {
			return false;
		}
		try {
			const mdl = await this._app.getBusinessObject('Module');
			// look for module row_id
			const ms = await mdl.search({ mdl_name: this.module.name} );
			const m = ms[0];
			await this.createFiles();
			const pom = await mdl.print('Module-MavenModule', m.row_id);
			await workspace.fs.writeFile(Uri.file(STORAGE_PATH + this.module.apiModuleName + '/pom.xml'), Buffer.from(pom.content, 'base64'));
			return true;
		} catch (e) {
			logger.error(e);
			return false;
		}
	}

	async createFiles (): Promise<any> {
		if (!this._simpliciteApi.devInfo) {
			return false;
		}
		for (const type in this.module.moduleDevInfo) {
			const businessObj = this._app.getBusinessObject(type, 'ide_' + type);
			for (const moduleObj of this.module.moduleDevInfo[type]) {
				if (!moduleObj.sourcepath) continue;
				const res = await businessObj.search({ row_id: moduleObj.id }, { inlineDocuments: [ true ] });
				if (!res || res.length === 0) continue;		
				const content = this.readContent(res[0], type);
				if (!content) continue;	
				const uri = Uri.file(STORAGE_PATH + this.module.apiModuleName + '/' + moduleObj.sourcepath);
				workspace.fs.writeFile(uri, Buffer.from(res[0][this._simpliciteApi.devInfo.getSourceField(type)].content, 'base64'));
			}
		}
	}

	private readContent (resObj: any, type: string): string | undefined {
		try {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const content = resObj[this._simpliciteApi.devInfo!.getSourceField(type)].content;
			return content;
		} catch (e) {
			return undefined;
		}
	}
}