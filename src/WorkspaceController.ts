// 'use strict';

// import { workspace, Uri, WorkspaceFolder, WorkspaceFoldersChangeEvent, window } from 'vscode';
// import { logger } from './Log';
// import { ApiModule } from './ApiModule';
// import { ModuleHandler } from './ModuleHandler';
// import { SimpliciteApiController } from './SimpliciteApiController';
// import { FileHandler } from './FileHandler';
// import { SimpliciteApi } from './SimpliciteApi';
// import { ModuleInfoTree } from './treeView/ModuleInfoTree';
// import { AppHandler } from './AppHandler';
// import { BarItem } from './BarItem';

// export class WorkspaceController {
// 	public static async removeApiFileSystemFromWorkspace (module: ApiModule) {
// 		try {
// 			if (!workspace.workspaceFolders) throw new Error(`Simplicite: Attempted to remove ${module.apiModuleName} but the current workspace seems to be empty`);
// 			const wkName = workspace.name;
// 			workspace.workspaceFolders.forEach((wk: WorkspaceFolder, i: number) => {
// 				if (wk.uri.path === module.workspaceFolderPath) workspace.updateWorkspaceFolders(i, 1);
// 			});
// 		} catch (e: any) {
// 			logger.error(e);
// 			window.showErrorMessage(e);
// 		}
// 	}
	
// 	public static addWorkspaceFolder(apiModuleName: string): void {
// 		let isProjectAlreadyInWorkspace = false;
// 		const workspaceFolderCount = workspace.workspaceFolders ? workspace.workspaceFolders?.length : 0;
// 		workspace.workspaceFolders?.forEach((wk: WorkspaceFolder) => {
// 			if (wk.name === apiModuleName) isProjectAlreadyInWorkspace = true;
// 		});
// 		if (!isProjectAlreadyInWorkspace) {
// 			try {
// 				workspace.updateWorkspaceFolders(workspaceFolderCount, 0, { uri: Uri.parse(STORAGE_PATH + apiModuleName), name: apiModuleName });
// 			} catch(e) {
// 				logger.error('Simplicité: ' + e);
// 			}
// 		}
// 	}
	
// 	public static async workspaceFolderChangeListener(moduleHandler: ModuleHandler, simpliciteApiController: SimpliciteApiController, fileHandler: FileHandler, simpliciteApi: SimpliciteApi, moduleInfoTree: ModuleInfoTree, appHandler: AppHandler, barItem: BarItem) {
// 		workspace.onDidChangeWorkspaceFolders(async (event: WorkspaceFoldersChangeEvent) => { // The case where one folder is added and one removed should not happen
// 			if (event.removed.length) {
// 				const currentModule = moduleHandler.getModuleFromWorkspacePath(event.removed[0].uri.path);
// 				if (!currentModule || !(currentModule instanceof ApiModule)) {
// 					logger.error('Workspace folders change detected but could not retrieve concerned module: ' + event.removed[0].uri.path);
// 					return;
// 				}
// 				WorkspaceController.deleteModuleAndFiles(currentModule, moduleHandler, barItem);
// 			}
// 			if (event.added.length) {
// 				await moduleHandler.setModulesFromScratch(appHandler, simpliciteApi);
// 				moduleHandler.setWorkspaceFolderPathValueOnNewApiModule(event.added[0].uri.path);
// 				fileHandler.fileList = await fileHandler.FileDetector(moduleHandler);
// 			}
// 			simpliciteApiController.loginAll();
// 		});
// 	}
	
// 	public static deleteModuleAndFiles(module: ApiModule, moduleHandler: ModuleHandler, barItem: BarItem) {
// 		moduleHandler.removeModule(module.name, module.instanceUrl);
// 		module.deleteProject();
// 		barItem.show(moduleHandler.modules, moduleHandler.connectedInstances);
// 	}
// }