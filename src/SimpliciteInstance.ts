'use strict';

import { Module } from './Module';
import { ApiModule } from './ApiModule';
import { NameAndWorkspacePath } from './interfaces';
import simplicite from 'simplicite';

// represent a simplicite instance
export class SimpliciteInstance {
	modules: Map<string, Module>;
	apiModules: Map<string, ApiModule>;
	app: any;
	constructor(modulesName: NameAndWorkspacePath[], instanceUrl: string) {
		this.modules = this.initModules(modulesName);
		this.apiModules = new Map();
		this.app = simplicite.session({ url: instanceUrl /*, debug: true*/ });
	}

	initModules(modulesName: NameAndWorkspacePath[]): Map<string, Module> {
		const modules: Map<string, Module> = new Map();
		modulesName.forEach((s: NameAndWorkspacePath) => {
			if(!modules.has(s.name)) modules.set(s.name, new Module(s.wkPath));
		});
		return modules;
	}
}