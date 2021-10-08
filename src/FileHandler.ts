'use strict';

import { logger } from './Log';
import { GlobPattern, RelativePattern, Uri, workspace, WorkspaceFolder, window } from 'vscode';
import * as fs from 'fs';
import { File } from './File';
import { Module } from './Module';
import { crossPlatformPath } from './utils';
import { TOKEN_SAVE_PATH, FILES_SAVE_PATH } from './constant';
import { parseStringPromise } from 'xml2js';
import { FileTree } from './treeView/FileTree';
import { FileAndModule } from './interfaces';

export class FileHandler {
    fileTree: FileTree;
    private fileList: Array<File>;
    private untrackedFiles: Array<File>;
    constructor (fileTree: FileTree) {
        this.fileTree = fileTree;
        this.fileList = new Array();
        this.untrackedFiles = new Array();
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

    async setFileList (modules: Array<Module>, uri: Uri | string) {
        try {
            for (let module of modules) {
                let filePath = '';
                if (uri instanceof Uri) {
                    filePath = crossPlatformPath(uri.path);
                } else if (typeof(uri) === 'string') {
                    filePath = uri;
                }
                this.cleanUntrackedFiles(filePath);
                const filePathLowerCase = filePath;
                const workspaceLowerCase = module.getWorkspaceFolderPath();
                if (filePathLowerCase.toLowerCase().search(workspaceLowerCase.toLowerCase()) !== -1) {
                    const file = new File(filePath, module.getInstanceUrl(), module.getWorkspaceFolderPath(), module.getName(), true);
                    if (!this.isFileInFileList(filePath)) {
                        this.fileList.push(file);
                        logger.info(`Change detected on ${filePath}`);
                    }
                } else {
                    for (let file of this.untrackedFiles) {
                        if (getObjectName(filePath, file.filePath)) {
                            const index = this.untrackedFiles.indexOf(file);
                            file.tracked = true;
                            this.fileList.push(file);
                            this.untrackedFiles.splice(index, 1);
                            break;
                        }
                    }
                }
            }
            this.saveJSONOnDisk(this.fileList, FILES_SAVE_PATH);
            await this.fileTree.setFileModule(this.bindFileAndModule(modules));
        } catch (e: any) {
            logger.error(e);
        }
    }

    cleanUntrackedFiles (filePath: string) {
        for (let file of this.untrackedFiles) {
            if (file.getFilePath() === filePath) {
                const index = this.untrackedFiles.indexOf(file);
                this.untrackedFiles.splice(index, 1);
            }
        }
        for (let file of this.fileList) {
            if (file.getFilePath() === filePath) {
                file.tracked = true;
            }
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
            for (let file of this.untrackedFiles) {
                if (file.moduleName === module.getName()) {
                    moduleObject.fileList.push(file);
                }
            }
            fileModule.push(moduleObject);
        }
        return fileModule;
    }

    deleteFileRouter (inputPath: string, modules: Module[], addUntrackFile: boolean): void {
        for (let file of this.fileList) {
            if (file.filePath.toLowerCase() === inputPath.toLowerCase() || getObjectName(inputPath, file.filePath)) {
                this.deleteFile(file, addUntrackFile);
            }
        }
    }

    deleteFile (file: File, addUntrackFile: boolean) {
        if (addUntrackFile) {
            file.tracked = false;
            this.untrackedFiles.push(file);
            let jsonContent;
            try {
                 jsonContent = JSON.parse(fs.readFileSync(FILES_SAVE_PATH, 'utf8'));
            } catch (e) {
                console.log(e);
            }
            for (let content of jsonContent) {
                if (content.filePath.toLowerCase() === file.getFilePath().toLowerCase()) {
                    content.tracked = false;
                }
            }
            try {
                this.saveJSONOnDisk(jsonContent, FILES_SAVE_PATH);   
            } catch(e) {
                console.log(e);
            }
        }
        const index = this.fileList.indexOf(file);
        this.fileList.splice(index, 1);
    }

    deleteFileFromDisk (path: string) {
        const jsonContent = JSON.parse(fs.readFileSync(FILES_SAVE_PATH, 'utf8'));
        for (let content of jsonContent) {
            if (content.filePath.toLowerCase() === path.toLowerCase()) {
                const index = jsonContent.indexOf(content);
                jsonContent.splice(index, 1);
            }
        }
        this.saveJSONOnDisk(jsonContent, FILES_SAVE_PATH);
    }

    deleteFileFromListAndDisk (path: string, modules: Module[]) {
        this.deleteFileFromDisk(path);
        this.deleteFileRouter(path, modules, false);
        for (let file of this.untrackedFiles) {
            if (file.filePath.toLowerCase() === path.toLowerCase() || getObjectName(path, file.filePath)) {
                const index = this.untrackedFiles.indexOf(file);
                this.untrackedFiles.splice(index, 1);
            }
        }
        this.fileTree.setFileModule(this.bindFileAndModule(modules));

        
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

    async getModifiedFilesOnStart (modules: Module[]) {
        try {   
            const jsonContent = JSON.parse(fs.readFileSync(FILES_SAVE_PATH, 'utf8'));
            for (let content of jsonContent) {
                if (content.tracked) {
                    this.fileList.push(new File(content.filePath, content.instanceUrl, content.workspaceFolderPath, content.moduleName, content.tracked));
                } if (!content.tracked) {
                    this.untrackedFiles.push(new File(content.filePath, content.instanceUrl, content.workspaceFolderPath, content.moduleName, content.tracked));
                }
            }
            await this.fileTree.setFileModule(this.bindFileAndModule(modules));
        } catch (e: any) {
            logger.info('simplicite-file.json not found: no modified files');
        }
    }

    readModifiedFiles () {
        try {
            return this.readFileSync(FILES_SAVE_PATH, 'utf8');
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

function getObjectName (inputPath: string, testFilePath: string) {
    const decomposedInput = inputPath.toLowerCase().split('/');
    const decomposedTest = testFilePath.toLowerCase().split('/');
    let lastInput = decomposedInput[decomposedInput.length - 1];
    let lastTest = decomposedTest[decomposedTest.length - 1];
    if (lastInput === lastTest) {
        return true;
    } else if (!lastInput.endsWith('.java')) {
        lastTest = lastTest.replace('.java', '');
        if (lastInput === lastTest) {
            return true;
        }
    }
    return false;
    
}