'use strict';

import { workspace, Uri, WorkspaceFolder, WorkspaceFoldersChangeEvent, window } from 'vscode';
import { ApiModule } from './ApiModule';
import { logger } from './Log';
import { SimpliciteInstanceController } from './SimpliciteInstanceController';

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
					await simpliciteInstanceController.removeModule(elem.name);
				});
			}
			if (event.added.length > 0) {
				await simpliciteInstanceController.setSimpliciteInstancesFromWorkspace();
				await simpliciteInstanceController.loginAll();	
			}
		});
	}
}