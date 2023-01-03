'use strict';

import { workspace, Uri, WorkspaceFolder, WorkspaceFoldersChangeEvent, window, RelativePattern, commands } from 'vscode';
import { ApiModule } from './ApiModule';
import { SimpliciteInstanceController } from './SimpliciteInstanceController';
import { recreateLocalUrl } from './utils';

export class WorkspaceController {
	public static removeApiFileSystemFromWorkspace(moduleName: string, instanceUrl: string) {
		try {
			if (!workspace.workspaceFolders) throw new Error(`Simplicite: Attempted to remove ${moduleName} but the current workspace seems to be empty`);
			workspace.workspaceFolders.forEach((wk: WorkspaceFolder, i: number) => {
				if (wk.name === ApiModule.getApiModuleName(moduleName, instanceUrl)) workspace.updateWorkspaceFolders(i, 1);
			});
		} catch (e: any) {
			console.error(e);
			window.showErrorMessage(e);
		}
	}

	public static isApiModuleInWorkspace(moduleName: string, instanceUrl: string): boolean {
		if (!workspace.workspaceFolders) return false;
		const wk = workspace.workspaceFolders.find((wk: WorkspaceFolder) => {
			if (wk.name === ApiModule.getApiModuleName(moduleName, instanceUrl)) return true;
		});
		if(wk) return true;
		return false;
	}

	public static async getApiModuleWorkspacePath(moduleName: string, instanceUrl: string): Promise<Uri> {
		if (workspace.workspaceFolders) {
			const wk = workspace.workspaceFolders.find((wk: WorkspaceFolder) => wk.name === ApiModule.getApiModuleName(moduleName, instanceUrl));
			if(!wk) {
				for(const wk of workspace.workspaceFolders) {
					const relativePattern = new RelativePattern(wk, '**/pom.xml');
					const files = await workspace.findFiles(relativePattern);
					for(const file of files) {
						// get api module name and compare with moduleName
						console.log(file);
					}
				}
			} else {
				return wk.uri;
			}
		}
		throw new Error('Unable to find the project folder of module ' + moduleName);
	}
	
	public static addWorkspaceFolder(apiModuleName: string): void {
		let isProjectAlreadyInWorkspace = false;
		const workspaceFolderCount = workspace.workspaceFolders ? workspace.workspaceFolders?.length : 0;
		workspace.workspaceFolders?.forEach((wk: WorkspaceFolder) => {
			if (wk.name === apiModuleName) isProjectAlreadyInWorkspace = true;
		});
		if (!isProjectAlreadyInWorkspace) {
			try {
				workspace.updateWorkspaceFolders(workspaceFolderCount, 0, { uri: Uri.parse(STORAGE_PATH + apiModuleName), name: apiModuleName });
			} catch(e) {
				console.error('Simplicité: ' + e);
			}
		}
	}
	
	public static async workspaceFolderChangeListener(simpliciteInstanceController: SimpliciteInstanceController) {
		workspace.onDidChangeWorkspaceFolders(async (event: WorkspaceFoldersChangeEvent) => {
			if (event.removed.length > 0) {
				event.removed.forEach(async (elem) => {
					const res = this.getFolderApiInstanceUrl(elem.name, simpliciteInstanceController);
					if(res && res.url) await simpliciteInstanceController.removeApiModule(res.moduleName, res.url);
					else await simpliciteInstanceController.removeModule(elem.name);
				});
			}
			if (event.added.length > 0) {
				await simpliciteInstanceController.setSimpliciteInstancesFromWorkspace();
				await simpliciteInstanceController.loginAll();
			}
			await commands.executeCommand('simplicite-vscode-tools.refreshModuleTree');
		});
	}

	// return the instance URL from the folder name if it exists, or return undefined
	// if it encounters locahost or 127.0.0.1 it will add the ':' character between the adress and the used port (see getApiModuleName method in ApiModule.ts)
	private static getFolderApiInstanceUrl(folderName: string, simpliciteInstanceController: SimpliciteInstanceController): { url: string | undefined; moduleName: string; } | undefined {
		const reg = new RegExp('^([A-Za-z0-9_-]+@[A-Za-z0-9-_\.]+)$');
		const res = reg.exec(folderName);
		if(res) {
			const split = res[0].split('@');
			const moduleName = split[0];
			let urlClue = split[1]; // taking the right part, using the module name to confirm the clue may be a good idea
			let apiUrlClue = urlClue;
			// does the trick
			apiUrlClue = recreateLocalUrl(urlClue);
			const url = simpliciteInstanceController.findInstanceUrlWithClue(moduleName, urlClue, apiUrlClue);
			return {url, moduleName};
		}
		return undefined;
	}
}