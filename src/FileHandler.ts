'use strict';

import { logger } from './Log';
import { GlobPattern, RelativePattern, workspace, WorkspaceFolder } from 'vscode';
import * as fs from 'fs';
import { File } from './File';
import { Module } from './Module';
import { crossPlatformPath, validFileExtension, removeFileExtension } from './utils';
import { TOKEN_SAVE_PATH, FILES_SAVE_PATH, supportedFiles } from './constant';
import { parseStringPromise } from 'xml2js';
import { FileTree } from './treeView/FileTree';
import { FileAndModule } from './interfaces';
import { ModuleHandler } from './ModuleHandler';

export class FileHandler {
    fileTree: FileTree;
    private fileList: Array<File>;
    moduleHandler: ModuleHandler;
    constructor (fileTree: FileTree, moduleHandler: ModuleHandler) {
        this.fileTree = fileTree;
        this.fileList = new Array();
        this.moduleHandler = moduleHandler;
    }

    static async build (fileTree: FileTree, moduleHandler: ModuleHandler): Promise<FileHandler> {
        const fileHandler = new FileHandler(fileTree, moduleHandler);
        try {
            fileHandler.moduleHandler.setModules(await fileHandler.getSimpliciteModules(), false); // need modules to create File
            fileHandler.fileList = await fileHandler.getFileOnStart();
            await fileHandler.fileTree.setFileModule(fileHandler.bindFileAndModule(moduleHandler.getModules()));
        } catch (e) {
            logger.error(e);
        }
        return fileHandler;
    }

    async simpliciteInfoGenerator (token: string, appURL: string) { // generates a JSON [{"projet": "...", "module": "...", "token": "..."}]
        let toBeWrittenJSON = new Array();
        const simpliciteModules = await this.getSimpliciteModules();
        for (let module of simpliciteModules) {
            if (module.getInstanceUrl() === appURL && !module.getToken()) { // only set the token for the object coming from the same instance => same token 
                module.setToken(token); 
                toBeWrittenJSON = toBeWrittenJSON.concat([module]);
            } else {
                toBeWrittenJSON = toBeWrittenJSON.concat([module]);   
            }
        }
        toBeWrittenJSON = this.getTokenFromSimpliciteInfo(toBeWrittenJSON);
        this.saveJSONOnDisk(toBeWrittenJSON, TOKEN_SAVE_PATH);
    }

    private getTokenFromSimpliciteInfo (toBeWrittenJSON: Array<Module>) {
        try {
            const parsedJson = this.getSimpliciteInfoContent();
            if (parsedJson === null) {
                throw new Error('Cannot get token. No simplicite info content found');
            }
            for (let diskInfo of parsedJson) {
                for (let preparedModule of toBeWrittenJSON) {
                    if (preparedModule.getName() === diskInfo.getName() && diskInfo.getToken() && !preparedModule.getToken()) {
                        preparedModule.setToken(diskInfo.getToken());
                    }
                }
            }
            return toBeWrittenJSON;
        } catch(e: any) {
            logger.info(e);
        }
        return toBeWrittenJSON;
    }

    saveJSONOnDisk (toBeWrittenJSON: Array<Module> | Array<File>, path: string) {
        try {
            fs.writeFileSync(path, JSON.stringify(toBeWrittenJSON));
        } catch (e: any) {
            logger.error(e);
        }
    }

    deleteSimpliciteInfo () {
        try {
            fs.unlinkSync(TOKEN_SAVE_PATH);
        } catch (e: any) {
            logger.error(e);
        }
    }

    deleteModuleJSON (instanceUrl: string | undefined, moduleName: string | undefined) {
        let moduleArray = this.getSimpliciteInfoContent();
        try {
            let newInfo = [];
            if (moduleArray === null) {
                throw new Error('Error getting simplicite info content');
            }
            for (let module of moduleArray) {
                if (instanceUrl) {
                    if (module.getInstanceUrl() !== instanceUrl) {
                        newInfo.push(module);
                    }
                } else if (moduleName) {
                    if (module.getName() !== moduleName) {
                        newInfo.push(module);
                    }
                }
                
            }
            this.saveJSONOnDisk(newInfo, TOKEN_SAVE_PATH);
        } catch (e: any) {
            throw e;
        }
    }

    getSimpliciteInfoContent (): Array<Module> | null {
        try {
            const modules: Array<Module> = new Array();
            const jsonContent = JSON.parse(fs.readFileSync(TOKEN_SAVE_PATH, 'utf8'));
            for (let moduleJson of jsonContent) {
                modules.push(new Module(moduleJson.name, moduleJson.workspaceFolderName, moduleJson.workspaceFolderPath, moduleJson.instanceUrl, moduleJson.token));
            }
            if (modules.length === 0) {
                return null;
            }
            return modules;
        } catch (e: unknown) {
            return null;
        }
        
    }

    readFileSync (path: string, encoding?: BufferEncoding | undefined) {
        try {
            return fs.readFileSync(path, encoding ? encoding : 'utf8');
        } catch (e: any) {
            throw e;
        }
    }

    async findFiles (globPatern: GlobPattern) {	
        let foundFile = new Array();
        let files;
        try {
            files = await workspace.findFiles(globPatern);
        } catch (e: any) {
            throw(e);
        }
        for (let file of files) {
            try {
                foundFile.push(this.readFileSync(crossPlatformPath(file.fsPath), 'utf8' ));
            } catch(e: any) {
                logger.error(e);
            }
        };
        return foundFile;
    };

    async getSimpliciteModules () { // returns array of module objects
        let modules = new Array();
        try {
            if (workspace.workspaceFolders === undefined) {
                throw new Error('No workspace detected');
            }
            for (let workspaceFolder of workspace.workspaceFolders) {
                const globPatern = '**/module-info.json'; // if it contains module-info.json -> simplicite module
                const relativePattern = new RelativePattern(workspaceFolder, globPatern);
                const modulePom = await this.findFiles(relativePattern);
                if (modulePom.length === 0) {
                    throw new Error('No module found');
                } 
                const instanceUrl = await this.getModuleInstanceUrl(workspaceFolder);
                if (modulePom[0]) {
                    modules.push(new Module(JSON.parse(modulePom[0]).name, workspaceFolder.name, crossPlatformPath(workspaceFolder.uri.path), instanceUrl, ''));
                }
            }
        } catch (e: any) {
            logger.warn(e);
        }
        return modules;
    }

    private async getModuleInstanceUrl (workspaceFolder: WorkspaceFolder): Promise<string | any> { // searches into pom.xml and returns the simplicite's instance url
        const globPatern = '**pom.xml';
        const relativePattern = new RelativePattern(workspaceFolder, globPatern);
        const pom = await this.findFiles(relativePattern);
        try {
            const res = await parseStringPromise(pom);
            return res.project.properties[0]['simplicite.url'][0];
        } catch (e) {
            logger.error(e);
        }
    }

    bindFileAndModule (modules: Array<Module>): FileAndModule[] {
        const fileModule = new Array();
        for (let module of modules) {
            const moduleObject = { moduleName: module.getName(), instanceUrl: module.getInstanceUrl(), fileList: new Array() };
            for (let file of this.fileList) {
                if (file.moduleName === module.getName()) {
                    moduleObject.fileList.push(file);
                }
            }
            fileModule.push(moduleObject);
        }
        return fileModule;
    }

    private updateFileStatusOnDisk () {
        const jsonContent = new Array();
        for (let file of this.fileList) {
            if (file.tracked) {
                jsonContent.push({filePath: file.getFilePath(), tracked: file.tracked});
            }
        }
        this.saveJSONOnDisk(jsonContent, FILES_SAVE_PATH);
    }

    getFileList () {
        return this.fileList;
    }

    fileListLength () {
        return this.fileList.length;
    }

    async getFileOnStart (): Promise<File[]> {
        if (workspace.workspaceFolders === undefined) {
            throw new Error('no workspace detected');
        }
        
        let fileList = new Array();
        for (let workspaceFolder of workspace.workspaceFolders) {
            for (let valid of supportedFiles) {
                const globPatern = '**/*' + valid;
                const relativePattern = new RelativePattern(workspaceFolder, globPatern);
                const files = await workspace.findFiles(relativePattern);
                for (let file of files) {
                    if (validFileExtension(file.path)) {
                        fileList.push(new File(file.path, this.moduleHandler.getModuleUrlFromWorkspacePath(workspaceFolder.uri.path), workspaceFolder.uri.path, workspaceFolder.name, false));
                    }
                }
            }
        }
        try {
            return this.setTrackedStatusFromDisk(fileList);
        } catch (e) {
            logger.warn('getFileOnStart: ' + e);
            return fileList;
        }
    }

    private setTrackedStatusFromDisk (fileList: File[]): File[] { 
        try {
            const jsonContent = JSON.parse(fs.readFileSync(FILES_SAVE_PATH, 'utf8'));
            for (let file of fileList) {
                for (let content of jsonContent) {
                    if (file.getFilePath() === content.filePath) {
                        file.tracked = content.tracked;
                        break;
                    }
                }
            }
        } catch (e: any) {
            throw new Error(e.message);
        }
        return fileList;
    }

    async setTrackedStatus (filePath: string, status: boolean, fileModule: FileAndModule[]): Promise<void> {
        for (let file of this.fileList) {
            if (file.getFilePath().toLowerCase() === filePath.toLowerCase()) {
                file.tracked = status;
            }
        }
        this.updateFileStatusOnDisk();
        await this.fileTree.setFileModule(fileModule);
        Promise.resolve();
    }

    getFileFromFullPath (fullPath: string): File {
        for (let file of this.fileList) {
            const lowercasePath = file.getFilePath();
            if (lowercasePath.toLowerCase() === fullPath.toLowerCase()) {
                return file;
            }
        }
        return new File('', '', '', '', false);
    }
}
