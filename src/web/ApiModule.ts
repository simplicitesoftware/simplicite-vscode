/* eslint-disable @typescript-eslint/naming-convention */
'use strict';

import { Module } from './Module';
import { workspace, Uri, Memento } from 'vscode';
import { Buffer } from 'buffer';
import { DevInfo } from './DevInfo';
import { ApiModuleSave } from './interfaces';
import { WorkspaceController } from './WorkspaceController';

// Api module does not have persistence over VS Code instances
export class ApiModule extends Module {
	public apiModuleName: string;
	public workspaceName: string | undefined;
	private _instanceUrl: string;
	private _app: any;
	private _globalState: Memento;
	constructor(name: string, instanceUrl: string, app: any, globalState: Memento, workspaceName: string | undefined) {
		super(name, instanceUrl, globalState);
		this.apiModuleName = ApiModule.getApiModuleName(name, instanceUrl);
		this.workspaceName = workspaceName;
		this._instanceUrl = instanceUrl;
		this._app = app;
		this._globalState = globalState;
	}

	static async buildApi(name: string, instanceUrl: string, app: any, globalState: Memento, devInfo: any, wkUri: Uri | undefined, createProject: boolean): Promise<ApiModule> {
		const apiModule = new ApiModule(name, instanceUrl, app, globalState, workspace.name);
		// if project has already been created
		if(wkUri) {
			await apiModule.initFiles(app, globalState, wkUri, []);
		} else if(createProject) {
			apiModule.setModuleDevInfo(devInfo, app)
			.then(() => apiModule.createProject(devInfo, name)
			.then(() => WorkspaceController.addWorkspaceFolder(apiModule.apiModuleName)));
		}
		return apiModule;
	}
	
	public static getApiModuleName (moduleName: string, instanceUrl: string) {
		let withoutHttp = instanceUrl.replace('https://', '');
		withoutHttp = withoutHttp.replace('http://', '');
		// remove forbidden ":" char for localhost folder creation cause format is localhost:<port>
		// if not done it will result in a file system error => forbidden character 
		withoutHttp = withoutHttp.replace(':', '');
		return moduleName + '@' + withoutHttp;
	}
	
	public async createProject(devInfo: DevInfo, moduleName: string): Promise<boolean> {
		const mdl = await this._app.getBusinessObject('Module');
		// look for module row_id
		const ms = await mdl.search({ mdl_name: moduleName} );
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
					console.error(e);
				}
			}
		}
	}
	
	private readContent (resObj: any, type: string, devInfo: DevInfo): string | undefined {
		try {
			const content = resObj[devInfo.getSourceField(type)].content;
			return content;
		} catch (e) {
			console.error(e);
			return undefined;
		}
	}

	public static deleteFiles(instanceUrl: string, moduleName: string) {
		const apiModuleName = ApiModule.getApiModuleName(moduleName, instanceUrl);
		const uri = Uri.file(STORAGE_PATH + apiModuleName);
		try {
			workspace.fs.delete(uri, { recursive: true });
		} catch(e) {
			console.error(e);
		}
		console.log('removed api module from workspace');
	}
}