'use strict';

import { ApiFileSystem } from './ApiFileSystem';
import { AppHandler } from './AppHandler';
import { ModuleHandler } from './ModuleHandler';
import { SimpliciteApi } from './SimpliciteApi';

export class ApiFileSystemController {
	apiFileSystemList: ApiFileSystem[];
	constructor() {
		this.apiFileSystemList = [];
	}

	async initApiFileSystems (moduleHandler: ModuleHandler, simpliciteApi: SimpliciteApi, appHandler: AppHandler) {
		for (const module of moduleHandler.modules) {
			try {
				for (const rfs of this.apiFileSystemList) {
					if (rfs.module.name === module.name) {
						throw new Error();
					}
				}
				if (module.apiFileSystem && simpliciteApi.devInfo) {
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
}

