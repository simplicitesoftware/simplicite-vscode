'use strict';

import { Module } from "./Module";
import { SimpliciteApi } from "./SimpliciteApi";
import { workspace, Uri } from "vscode";
import { logger } from "./Log";
import { WorkspaceController } from "./WorkspaceController";
import { Buffer } from "buffer";

export class ApiModule extends Module {
  private _app: any;
	private _simpliciteApi: SimpliciteApi | null;
  apiModuleName: string;
	workspaceName: string | undefined;
  constructor(name: string, workspaceFolderPath: string, instanceUrl: string, token: string, app: any, simpliciteApi: SimpliciteApi | null, workspaceName: string | undefined) {
    super(name, workspaceFolderPath, instanceUrl, token);
    this.apiModuleName = ApiModule.getApiModuleName(name, instanceUrl);
    this._app = app;
		this._simpliciteApi = simpliciteApi;
		this.workspaceName = workspaceName;
  }

  public static getApiModuleName (moduleName: string, instanceUrl: string) {
		let withoutHttp = instanceUrl.replace('https://', '');
		withoutHttp = withoutHttp.replace('http://', '');  
		return moduleName + "@" + withoutHttp;
	}

  async initApiFileSystemModule() {
    // test for workspace
    await this.createProject();
    WorkspaceController.addWorkspaceFolder(this.apiModuleName);
	}

	async createProject(): Promise<boolean> {
			const mdl = await this._app.getBusinessObject('Module');
			// look for module row_id
			const ms = await mdl.search({ mdl_name: this.name} );
			const m = ms[0];
			await this.createFiles();
			const pom = await mdl.print('Module-MavenModule', m.row_id);
			await workspace.fs.writeFile(Uri.file(STORAGE_PATH + this.apiModuleName + '/pom.xml'), Buffer.from(pom.content, 'base64'));
			return true;
	}

	async createFiles (): Promise<any> {
		if (!this._simpliciteApi || !this._simpliciteApi.devInfo) return false;
		for (const type in this.moduleDevInfo) {
			const businessObj = this._app.getBusinessObject(type, 'ide_' + type);
			for (const moduleObj of this.moduleDevInfo[type]) {
				if (!moduleObj.sourcepath) continue;
				try {
					const res = await businessObj.search({ row_id: moduleObj.id }, { inlineDocuments: [ true ] });
					if (!res || res.length === 0) continue;		
					const content = this.readContent(res[0], type);
					if (!content) continue;	
					const uri = Uri.file(STORAGE_PATH + this.apiModuleName + '/' + moduleObj.sourcepath);
					workspace.fs.writeFile(uri, Buffer.from(res[0][this._simpliciteApi.devInfo.getSourceField(type)].content, 'base64'));
				} catch(e) {
					logger.error(e);
				}
				
			}
		}
	}

	private readContent (resObj: any, type: string): string | undefined {
		try {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (!this._simpliciteApi || !this._simpliciteApi.devInfo) throw new Error("simplicite Api is not defined or devInfo is not set");
			const content = resObj[this._simpliciteApi.devInfo.getSourceField(type)].content;
			return content;
		} catch (e) {
      logger.error(e);
			return undefined;
		}
	}

  public deleteProject() {
    // important condition, if empty string => Uri.file can resolve to the root of the main disk and delete every file (not fun)
    if (this.workspaceFolderPath === '') { 
      logger.error('workspaceFolderPath is undefined');
      return;
    }
    const uri = Uri.file(this.workspaceFolderPath);
    try {
      workspace.fs.delete(uri, { recursive: true });
    } catch(e) {
      logger.error(e);
    }
    logger.info('removed api module from workspace');
  }
}