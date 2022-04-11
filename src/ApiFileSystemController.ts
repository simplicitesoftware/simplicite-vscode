'use strict';

import { ApiFileSystem } from './ApiFileSystem';
import { AppHandler } from './AppHandler';
import { ModuleHandler } from './ModuleHandler';
import { SimpliciteApi } from './SimpliciteApi';
import { Module } from './Module';
import { SimpliciteApiController } from './SimpliciteApiController';
import { workspace } from 'vscode';
import { ApiModule } from './ApiModule';

// gets called in extension.ts to init the already existants api file systems
export class ApiFileSystemController {
	apiFileSystemList: ApiFileSystem[];
	simpliciteApiController: SimpliciteApiController
	moduleHandler: ModuleHandler;
	constructor(simpliciteApiController: SimpliciteApiController, moduleHandler: ModuleHandler) {
		this.apiFileSystemList = [];
		this.simpliciteApiController  = simpliciteApiController;
		this.moduleHandler = moduleHandler;
	}

	public async initApiFileSystems (moduleHandler: ModuleHandler, simpliciteApi: SimpliciteApi, appHandler: AppHandler) {
		for (const module of moduleHandler.modules) {
			try {
				for (const rfs of this.apiFileSystemList) {
					if (rfs.module.name === module.name) {
						throw new Error();
					}
				}
				if (simpliciteApi.devInfo && module instanceof ApiModule) {
					const app = appHandler.getApp(module.instanceUrl);
					const rfsControl = new ApiFileSystem(app, module, simpliciteApi);
					this.apiFileSystemList.push(rfsControl);
					await rfsControl.initApiFileSystemModule(moduleHandler);	
				}
			} catch (e) {
				continue;
			}
		}
	}

	private getApiFileSystem (apiModuleName: string) {
		for (const apiFileSystem of this.apiFileSystemList) {
			if (apiFileSystem.module.apiModuleName === apiModuleName) return apiFileSystem;
		}
	}

	private getApiModule (apiModuleName: string): Module | undefined {
		return this.getApiFileSystem(apiModuleName)?.module;
	}

	private getSameInstanceApiFileSystem (instanceUrl: string): ApiFileSystem[] {
		const afs = new Array();
		for (const apiFileSystem of this.apiFileSystemList) {
			if (apiFileSystem.module.instanceUrl === instanceUrl) {
				afs.push(apiFileSystem);
			}
		}
		return afs;
	}

	public async removeApiFileSystem (module: ApiModule) {
		// this function has the responsability to check how many modules depends from the targeted module's instance url
		// only one module is connected --> deconnect from it as it won't affect any module
		// Many modules connected to same instance --> dont deconnect, simply remove the apiFileSystem
		const count = this.countConnectedModulesFromSameInstance(module.instanceUrl);
		if (count === 1) await this.simpliciteApiController.instanceLogout(module.instanceUrl);
		this.removeFromAfsListAndModuleList(module);
	}

	private countConnectedModulesFromSameInstance (instanceUrl: string) {
		let count: number = 0;
		for (const mod of this.moduleHandler.modules) {
			if (instanceUrl === mod.instanceUrl && mod.connected) count++;
		}
		return count;
	}

	// see how it goes with new ApiModule implementation
	private removeFromAfsListAndModuleList (module: ApiModule) {
		this.apiFileSystemList.forEach((apiFileSystem: ApiFileSystem, index: number) => {
			if (apiFileSystem.module.apiModuleName === module.apiModuleName) this.apiFileSystemList.splice(index, 1);
		});
		this.moduleHandler.removeModule(module.apiModuleName, module.instanceUrl, true);
	}
}

