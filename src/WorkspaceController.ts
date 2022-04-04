'use strict';

import { workspace, Uri, WorkspaceFolder } from "vscode";
import { Module } from "./Module";
import { logger } from "./Log";

export class WorkspaceController {
  constructor () {}

  public static async removeApiFileSystemFromWorkspace (module: Module) {
    try {

      if (!workspace.workspaceFolders) {
        throw new Error(`Simplicite: Attempted to remove ${module.apiModuleName} but the current workspace seems to be empty`);
      }
      workspace.workspaceFolders.forEach((wk: WorkspaceFolder, i: number) => {
        if (wk.name === module.parentFolderName) workspace.updateWorkspaceFolders(i, 1);
      });
      
      // need to delete after workspace change, otherwise resource is busy
      // BEWARE
      // important condition, if empty string => Uri.file can resolve to the root of the main disk and delete every file
      if (module.workspaceFolderPath === '') throw new Error('No module workspaceFolderPath');
      const uri = Uri.file(module.workspaceFolderPath);
      await workspace.fs.delete(uri , { recursive: true });

    } catch (e) {
      logger.error(e);
    }
  }
  
}