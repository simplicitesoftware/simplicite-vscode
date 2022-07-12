'use strict';

import { Module } from './Module';
import { workspace, Uri, Memento } from 'vscode';
import { logger } from './Log';
import { Buffer } from 'buffer';
import { DevInfo } from './DevInfo';
import { ApiModuleSave } from './interfaces';

// Api module does not have persistence over VS Code instances
export class ApiModule extends Module {
	public apiModuleName: string;
	private _instanceUrl: string;
	private _app: any;
	private _globalState: Memento;
	constructor(name: string, instanceUrl: string, app: any, globalState: Memento) {
		super(name);
		this.apiModuleName = ApiModule.getApiModuleName(name, instanceUrl);
		this._instanceUrl = instanceUrl;
		this._app = app;
		this._globalState = globalState;
	}
	
	public static getApiModuleName (moduleName: string, instanceUrl: string) {
		let withoutHttp = instanceUrl.replace('https://', '');
		withoutHttp = withoutHttp.replace('http://', '');  
		return moduleName + '@' + withoutHttp;
	}
	
	public async createProject(devInfo: DevInfo): Promise<boolean> {
		const mdl = await this._app.getBusinessObject('Module');
		// look for module row_id
		const ms = await mdl.search({ mdl_name: ''} ); // todo
		const m = ms[0];
		await this.createFiles(devInfo);
		const pom = await mdl.print('Module-MavenModule', m.row_id);
		await workspace.fs.writeFile(Uri.file(STORAGE_PATH + this.apiModuleName + '/pom.xml'), Buffer.from(pom.content, 'base64'));
		return true;
	}
	
	private async createFiles (devInfo: DevInfo): Promise<any> {
		// Loop on every object contained in moduleDevInfo, get file content and create project structure
		for (const type in this.moduleDevInfo) {
			const businessObj = this._app.getBusinessObject(type, 'ide_' + type);
			for (const moduleObj of this.moduleDevInfo[type]) {
				if (!moduleObj.sourcepath) continue;
				try {
					const res = await businessObj.search({ row_id: moduleObj.id }, { inlineDocuments: [ true ] });
					if (!res || res.length === 0) continue;		
					const content = this.readContent(res[0], type, devInfo);
					if (!content) continue;
					const uri = Uri.file(STORAGE_PATH + this.apiModuleName + '/' + moduleObj.sourcepath);
					workspace.fs.writeFile(uri, Buffer.from(res[0][devInfo.getSourceField(type)].content, 'base64'));
				} catch(e) {
					logger.error(e);
				}
			}
		}
	}
	
	private readContent (resObj: any, type: string, devInfo: DevInfo): string | undefined {
		try {
			const content = resObj[devInfo.getSourceField(type)].content;
			return content;
		} catch (e) {
			logger.error(e);
			return undefined;
		}
	}

	public saveApiModule(): void {
		const saved: ApiModuleSave[] = this._globalState.get(API_MODULES_STORAGE) || [];
		// if workspaceFolders is undefined then vscode needs to restart, delete will be set on true on restart
		let toDelete = true;
		if(!workspace.workspaceFolders) {
			toDelete = false;
		}
		saved.push({moduleName: this.name, instanceUrl: this._instanceUrl, toDelete: toDelete});
		this._globalState.update(API_MODULES_STORAGE, saved);
	}

	public deleteFiles() {
		const uri = Uri.file(STORAGE_PATH + this.apiModuleName);
		try {
			workspace.fs.delete(uri, { recursive: true });
		} catch(e) {
			logger.error(e);
		}
		logger.info('removed api module from workspace');
	}
}