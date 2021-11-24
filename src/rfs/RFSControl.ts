/* eslint-disable @typescript-eslint/no-non-null-assertion */
'use strict';

import { workspace, Disposable, Uri, window, commands } from 'vscode';
import { AppHandler } from '../AppHandler';
import { DevInfoObject } from '../interfaces';
import { logger } from '../Log';
import { Module } from '../Module';
import { SimpliciteFS } from './SimpliciteFS';
import { replaceAll } from '../utils';

export class RFSControl {
	appHandler: AppHandler;
	modules: Module[];
	simpliciteFS?: SimpliciteFS;
	app?: any;
	subscriptions: Disposable[];
	scheme: string;
	isInit: boolean;
	firstConnection: boolean;
	module?: Module;
	FSPDisposable?: Disposable;
	devInfo?: DevInfoObject;

	constructor (appHandler: AppHandler, modules: Module[], subscriptions: Disposable[]) {
		this.appHandler = appHandler;
		this.modules = modules;
		this.subscriptions = subscriptions;
		this.scheme = 'simplicite';
		this.isInit = false;
		this.firstConnection = true;
	}

	async init (module: Module, devInfo: DevInfoObject): Promise<void> {
		if (!this.isInit) {
			this.subscriptions.push(commands.registerCommand('simplicite-vscode-tools.initWorkspace', () => {
				workspace.updateWorkspaceFolders(0, 1, { uri: Uri.parse('simplicite:/'), name: this.module?.name });
			}));
			this.subscriptions.push(commands.registerCommand('simplicite-vscode-tools.initFiles', async () => {
				await this.initFiles();
			}));
			this.isInit = true;
		}
		if (this.firstConnection) {
			this.module = module;
			this.devInfo = devInfo;
			this.app = this.appHandler.getApp(this.module.instanceUrl);
			this.simpliciteFS = new SimpliciteFS(this.app);
			this.FSPDisposable = workspace.registerFileSystemProvider(this.scheme, this.simpliciteFS, { isCaseSensitive: true });
			this.subscriptions.push(this.FSPDisposable);
			this.firstConnection = false;
			await this.initFiles();
			window.showInformationMessage('RFS INIT');
		} else {
			window.showErrorMessage('rfs already init');
		}
	}

	unset (): void {
		this.firstConnection = true;
		this.module = undefined;
		this.app = undefined;
		this.simpliciteFS = undefined;
		this.FSPDisposable?.dispose();
		this.FSPDisposable = undefined;
	}

	async initFiles(): Promise<boolean> {
		if (!this.simpliciteFS || !this.module) {
			return false;
		}
		try {
			const mdl = await this.app.getBusinessObject('Module');
			const ms = await mdl.search({ mdl_name: this.module.name} );
			const m = ms[0];
			await this.getAllFiles(m.row_id);
			const pom = await mdl.print('Module-MavenModule', m.row_id);
			this.simpliciteFS.writeFile(Uri.parse(this.scheme + ':/pom.xml'), Buffer.from(pom.content, 'base64'), { create: true, overwrite: true });
			return true;
		} catch (e) {
			logger.error(e);
			return false;
		}
	}

	async getAllFiles (mdl_id: string): Promise<any> {
		if (!this.devInfo || !this.simpliciteFS) {
			return false;
		}
		this.initFodlerTree();
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
				const uri = Uri.parse(this.scheme + ':/' + replace + '/' + this.module?.name + '/' + object[devObj.sourcefield].name);
				this.simpliciteFS.writeFile(uri, Buffer.from(object[devObj.sourcefield].content, 'base64'), { create: true, overwrite: true });
			}
		}
	}

	initFodlerTree() {
		this.simpliciteFS!.createDirectory(Uri.parse(this.scheme + ':/' + 'src'));
		this.simpliciteFS!.createDirectory(Uri.parse(this.scheme + ':/' + 'src/com'));
		this.simpliciteFS!.createDirectory(Uri.parse(this.scheme + ':/' + 'src/com/simplicite'));
	}

	async refreshBusinessObjects(mdlId: number, mdlName: string) {
		const obj: any= this.app.getBusinessObject('ObjectInternal');
		obj.search({ row_module_id: mdlId }, { inlineDocuments: [ 'obo_script_id' ] }).then(async (os: any) => {
			this.app.debug(JSON.stringify(os));
			const uri= '/src/com/simplicite/objects';

			for (let i = 0; i < os.length; i++) {
				const o: any = os[i];
				this.app.debug(JSON.stringify(o));
				const d: any = o.obo_script_id;
				if (d) {
					const u = Uri.parse(`${uri}/${d.name}`);
					this.simpliciteFS!.writeFile(u, Buffer.from(d.content, 'base64'), { create: true, overwrite: true });
					this.simpliciteFS!.setRecord(u.path, obj.getName(), 'obo_script_id', o.row_id);
				}
			}
		});
	}

	createFolderTree (folderPath: string) {
		const split = folderPath.split('/');
		if (split[split.length - 1] === 'dispositions') {
			let path = this.scheme + ':/scripts';
			this.simpliciteFS!.createDirectory(Uri.parse(path));
			path += '/Disposition';
			this.simpliciteFS!.createDirectory(Uri.parse(path));
		} else {
			let path = this.scheme + ':/src/com/simplicite/' + split[split.length - 1];
			this.simpliciteFS!.createDirectory(Uri.parse(path));
			path += '/' + this.module?.name;
			this.simpliciteFS!.createDirectory(Uri.parse(path));
		}
	}
}