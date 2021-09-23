'use strict';

import { logger } from './Log';
import { GlobPattern, RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import * as fs from 'fs';
import { File } from './File';
import { Module } from './Module';
import { crossPlatformPath } from './utils';
import { TOKEN_SAVE_PATH, FILES_SAVE_PATH } from './constant';
import { parseStringPromise } from 'xml2js';

export class FileHandler {
    private fileList: Array<File>;
    constructor () {
        this.fileList = new Array();
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

    getTokenFromSimpliciteInfo (toBeWrittenJSON: Array<Module>) {
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

    deleteInstanceJSON (instanceUrl: string) {
        let moduleArray = this.getSimpliciteInfoContent();
        try {
            let newInfo = [];
            if (moduleArray === null) {
                throw new Error('Error getting simplicite info content');
            }
            for (let module of moduleArray) {
                if (module.getInstanceUrl() !== instanceUrl) {
                    newInfo.push(module);
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

    async getModuleInstanceUrl (workspaceFolder: WorkspaceFolder): Promise<string | any> { // searches into pom.xml and returns the simplicite's instance url
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

    setFileList (modules: Array<Module>, uri: Uri) {
        try {
            for (let module of modules) {
                const filePath = crossPlatformPath(uri.path);
                const filePathLowerCase = filePath;
                const workspaceLowerCase = module.getWorkspaceFolderPath();
                if (filePathLowerCase.toLowerCase().search(workspaceLowerCase.toLowerCase()) !== -1) {
                    const file = new File(filePath, module.getInstanceUrl(), module.getWorkspaceFolderPath());
                    if (!this.isFileInFileList(filePath)) {
                        this.fileList.push(file);
                        console.log(`Change detected on ${filePath}`);
                    }
                }
            }
            this.saveJSONOnDisk(this.fileList, FILES_SAVE_PATH);
            logger.info('File change detected on ' + crossPlatformPath(uri.path));
        } catch (e: any) {
            logger.error(e);
        }
    }

    getFileList () {
        return this.fileList;
    }

    resetFileList () {
        this.fileList = new Array();
    }

    fileListLength () {
        return this.fileList.length;
    }

    getModifiedFilesOnStart () {
        try {   
            const jsonContent = JSON.parse(fs.readFileSync(FILES_SAVE_PATH, 'utf8'));
            for (let content of jsonContent) {
                this.fileList.push(new File(content.filePath, content.instanceUrl, content.workspaceFolderPath));
            }
        } catch (e: any) {
            logger.info('simplicite-file.json not found: no modified files');
        }
    }

    readModifiedFiles () {
        try {
            return this.readFileSync(FILES_SAVE_PATH);
        } catch (e: any) {
            throw e;
        }
    }

    deleteModifiedFiles () {
        try {
            fs.unlinkSync(FILES_SAVE_PATH);
        } catch (e: any) {
            logger.error(e);
        }
    }

    isFileInFileList (filePath: string) {
        for (let fileListelement of this.fileList) {
            if (fileListelement.getFilePath() === filePath) {
                return true;
            }
        }
        return false;
    }

    getOnlyFilesPath (workspaceFolderPath: string) {
        let filesPath = new Array();
        for (let file of this.fileList) {
            if (workspaceFolderPath === file.getWorkspaceFolderPath()) {
                filesPath.push(file.getFilePath());
            }
        }
        return filesPath;
    }
    
}