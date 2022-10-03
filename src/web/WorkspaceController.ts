'use strict';

import { workspace, Uri, WorkspaceFolder, WorkspaceFoldersChangeEvent, window } from 'vscode';
import { ApiModule } from './ApiModule';
import { logger } from './log';
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
			logger.error(e);
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

	public static getApiModuleWorkspacePath(moduleName: string, instanceUrl: string): string {
		if (!workspace.workspaceFolders) return 'Untitled (Workspace)';
		const wk = workspace.workspaceFolders.find((wk: WorkspaceFolder) => wk.name === ApiModule.getApiModuleName(moduleName, instanceUrl));
		if(!wk) return 'Untitled (Workspace)';
		return wk.uri.path;
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
				logger.error('Simplicité: ' + e);
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