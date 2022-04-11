'use strict';

import { Module } from "./Module";

// removeModule, getWorkspaceFolderPath  ModuleHandler todo

export class ApiModule extends Module {
  apiModuleName: string;
  constructor(name: string, workspaceFolderPath: string, instanceUrl: string, token: string, apiFileSystem: boolean, instanceJump: boolean) {
    super(name, workspaceFolderPath, instanceUrl, token, instanceJump);
    this.apiModuleName = ApiModule.getApiModuleName(name, instanceUrl);
  }

  private static getApiModuleName (moduleName: string, instanceUrl: string) {
		let withoutHttp = instanceUrl.replace('https://', '');
		withoutHttp = withoutHttp.replace('http://', '');  
		return moduleName + "@" + withoutHttp;
	}
}