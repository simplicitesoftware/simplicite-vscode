'use strict';

import { workspace, Uri, WorkspaceFolder, WorkspaceFoldersChangeEvent, window } from "vscode";
import { Module } from "./Module";
import { logger } from "./Log";
import { ApiModule } from "./ApiModule";
import { ModuleHandler } from "./ModuleHandler";
import { SimpliciteApiController } from "./SimpliciteApiController";
import { FileHandler } from "./FileHandler";
import { SimpliciteApi } from "./SimpliciteApi";
import { ModuleInfoTree } from "./treeView/ModuleInfoTree";
import { AppHandler } from "./AppHandler";

export class WorkspaceController {
  public static async removeApiFileSystemFromWorkspace (module: ApiModule) {
    try {
      if (!workspace.workspaceFolders) throw new Error(`Simplicite: Attempted to remove ${module.apiModuleName} but the current workspace seems to be empty`);
      workspace.workspaceFolders.forEach((wk: WorkspaceFolder, i: number) => {
        //if (wk.name === module.parentFolderName) workspace.updateWorkspaceFolders(i, 1); todo
      });
    } catch (e: any) {
      logger.error(e);
      window.showErrorMessage(e);
    }
  }

  public static addWorkspaceFolder(apiModuleName: string): void {
    let isProjectAlreadyInWorkspace = false;
    workspace.workspaceFolders?.forEach((wk: WorkspaceFolder) => {
      if (wk.name === apiModuleName) isProjectAlreadyInWorkspace = true;
    });
    if (!isProjectAlreadyInWorkspace) {
      try {
        workspace.updateWorkspaceFolders(0, 0, { uri: Uri.parse(STORAGE_PATH + apiModuleName), name: apiModuleName });
      } catch(e) {
        logger.error('Simplicité: ' + e);
      }
    }
  }

  public static workspaceFolderChangeListener(moduleHandler: ModuleHandler, simpliciteApiController: SimpliciteApiController, fileHandler: FileHandler, simpliciteApi: SimpliciteApi, moduleInfoTree: ModuleInfoTree, appHandler: AppHandler) {
    // is it called when a api module is added ??

    // workspace.onDidChangeWorkspaceFolders(async (event: WorkspaceFoldersChangeEvent) => { // The case where one folder is added and one removed should not happen
    //   await moduleHandler.setModulesFromScratch(); // resets the modules from disk and persistance
    //   // if (event.added.length > 0) { // If a folder is added to workspace
    //   //   // const currentModule = moduleHandler.getModuleFromWorkspacePath(event.added[0].uri.path);
    //   //   // if (!currentModule) throw new Error('No known module name matches with the root folder of the added project. Root folder = ' + event.added[0].name);
    //   //   // await simpliciteApiController.tokenOrCredentials(currentModule); // connect with the module informations
    //   //   // logger.info('successfully added module to workspace');
    //   // } else
    //    if (event.removed.length > 0) {
    //     // refresh for potential api file systems
    //     // usefull when user removes the workspace using the vscode shortcut (should be using the command)
    //     const module = moduleHandler.removeModuleFromWkPath(event.removed[0].uri.path);
    //     let index = 0;
    //     // if module is empty 
    //     if (!module) return;
    //     for (const rfs of apiFileSystemController.apiFileSystemList) {
    //       index++;
    //       if (rfs.module.name === module.name) {
    //         // todo
    //         // if (rfs.module.workspaceFolderPath === '') { // important condition, if empty string => Uri.file can resolve to the root of the main disk and delete every file (not fun)
    //         // 	logger.error('workspaceFolderPath is undefined');
    //         // 	return;
    //         // }
    //         // const uri = Uri.file(rfs.module.workspaceFolderPath);
    //         // workspace.fs.delete(uri);
    //         // apiFileSystemController.apiFileSystemList = apiFileSystemController.apiFileSystemList.splice(index, 1);
    //         // logger.info('removed api module from workspace');
    //         // break;
    //       }
    //     }
    //   }
      // await simpliciteApiController.loginAll();
      // // refresh all
      // fileHandler.fileList = await fileHandler.FileDetector(moduleHandler.modules);
      // moduleInfoTree.feedData(simpliciteApi.devInfo, moduleHandler.modules);
      // await apiFileSystemController.initApiFileSystems(moduleHandler, simpliciteApi, appHandler);
    // });
  } 
  
}