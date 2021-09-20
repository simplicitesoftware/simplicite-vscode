'use strict';

const logger = require('./Log');
const vscode = require('vscode');
const fs = require('fs');
const { File, Module } = require('./classIndex');
var parseString = require('xml2js').parseStringPromise;
const { crossPlatformPath } = require('./utils');

class FileHandler {
    constructor () {
        this.TOKEN_SAVE_PATH = crossPlatformPath(require('./constant').TOKEN_SAVE_PATH);
        this.FILES_SAVE_PATH = crossPlatformPath(require('./constant').FILES_SAVE_PATH);
        this.fileList = new Array();
    }

    async simpliciteInfoGenerator (token, appURL) { // generates a JSON [{"projet": "...", "module": "...", "token": "..."}]
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
        this.saveJSONOnDisk(toBeWrittenJSON, this.TOKEN_SAVE_PATH);
    }

    getTokenFromSimpliciteInfo (toBeWrittenJSON) {
        try {
            const parsedJson = this.getSimpliciteInfoContent();
            for (let diskInfo of parsedJson) {
                for (let preparedModule of toBeWrittenJSON) {
                    if (preparedModule.getName() === diskInfo.name && diskInfo.token && !preparedModule.getToken()) {
                        preparedModule.setToken(diskInfo.token);
                    }
                }
            }
            return toBeWrittenJSON;
        } catch(e) {
            logger.info(e);
        }
        return toBeWrittenJSON;
    }

    saveJSONOnDisk (toBeWrittenJSON, path) {
        try {
            fs.writeFileSync(path, JSON.stringify(toBeWrittenJSON));
        } catch (e) {
            logger.error(e);
        }
    }

    deleteSimpliciteInfo () {
        try {
            fs.unlinkSync(this.TOKEN_SAVE_PATH);
        } catch (e) {
            logger.error(e);
        }
    }

    deleteInstanceJSON (instanceUrl) {
        let moduleArray = this.getSimpliciteInfoContent();
        try {
            let newInfo = [];
            for (let module of moduleArray) {
                if (module.instanceUrl !== instanceUrl) {
                    newInfo.push(module);
                }
            }
            this.saveJSONOnDisk(newInfo, this.TOKEN_SAVE_PATH);
        } catch (e) {
            throw e;
        }
    }

    getSimpliciteInfoContent () {
        try {
            return JSON.parse(fs.readFileSync(this.TOKEN_SAVE_PATH, 'utf8'));
        } catch (e) {
            if (e.code === 'ENOENT') throw e.message;
            throw e;
        }
    }

    readFileSync (path, encoding) {
        try {
            return fs.readFileSync(path, encoding ? encoding : 'utf8');
        } catch (e) {
            if (e.code === 'ENOENT') throw e.message;
            throw e;
        }
    } 

    async findFiles (globPatern) {	
        let foundFile = new Array();
        let files;
        try {
            files = await vscode.workspace.findFiles(globPatern);
        } catch (e) {
            throw(e);
        }
        for (let file of files) {
            try {
                foundFile.push(this.readFileSync(crossPlatformPath(file.fsPath), 'utf8' ));
            } catch(err) {
                logger.error(err);
            }
        };
        return foundFile;
    };

    async getSimpliciteModules () { // returns array of module objects
        let modules = new Array();
        try {
            for (let workspaceFolder of vscode.workspace.workspaceFolders) {
                const globPatern = '**/module-info.json'; // if it contains module-info.json -> simplicite module
                const relativePattern = new vscode.RelativePattern(workspaceFolder, globPatern);
                const modulePom = await this.findFiles(relativePattern);
                if (modulePom.length === 0) throw 'No module found';
                const instanceUrl = await this.getModuleInstanceUrl(workspaceFolder);
                if (modulePom[0]) modules.push(new Module(JSON.parse(modulePom[0]).name, workspaceFolder.name, crossPlatformPath(workspaceFolder.uri.path), instanceUrl));
            }
        } catch (e) {
            logger.warn(e);
        }
        return modules;
    }

    getModuleInstanceUrl (workspaceFolder) { // searches into pom.xml and returns the simplicite's instance url
        return new Promise(async (resolve, reject) => {
            const globPatern = '**pom.xml';
            const relativePattern = new vscode.RelativePattern(workspaceFolder, globPatern);
            const pom = await this.findFiles(relativePattern);
            parseString(pom).then(res => {
                resolve(res.project.properties[0]['simplicite.url'][0]);
            }).catch(e => {
                reject(e);
            });
        })
    }

    async setFileList (modules, uri) {
        return new Promise(async (resolve, reject) => {
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
                this.saveJSONOnDisk(this.fileList, this.FILES_SAVE_PATH);
                logger.info('File change detected');
                resolve();
            } catch (e) {
                logger.error(e);
                reject();
            }
        })
    }

    getModifiedFilesOnStart () {
        try {
            const JSONContent = require(this.FILES_SAVE_PATH);
            for (let content of JSONContent) {
                this.fileList.push(new File(content.filePath, content.instanceUrl, content.workspaceFolderPath));
            }
        } catch (e) {
            logger.info('simplicite-file.json not found');
        }
    }

    deleteModifiedFilesPersistance (problematicFile, instanceUrl) {
        try {
            if (problematicFile.length === 0) return;
            const toBeWrittenJSON = new Array();
            const JSONContent = require(this.FILES_SAVE_PATH);
            for (let content of JSONContent) {
                for (let pFile of problematicFile) {
                    if (content.filePath === pFile && instanceUrl === content.instanceUrl) {
                        toBeWrittenJSON.push(content);
                    }
                }
            }
            this.saveJSONOnDisk(toBeWrittenJSON, this.FILES_SAVE_PATH);
        } catch (e) {
            logger.error(e);
        }
    }

    deleteModifiedFiles (problematicFile, instanceUrl) {
        try {
            const newFileList = new Array();
            for (let file of this.fileList) {
                for (let pFile of problematicFile) {
                    if (file.filePath === pFile && instanceUrl === file.instanceUrl) {
                        newFileList.push(file);
                    }
                }
            }
            this.fileList = newFileList;
            console.log(this.fileList);
        } catch(e) {
            logger.error(e);
        }        
    }

    isFileInFileList (filePath) {
        for (let fileListelement of this.fileList) {
            if (fileListelement.getFilePath() === filePath) return true; 
        }
        return false;
    }

    getOnlyFilesPath (workspaceFolderPath) {
        let filesPath = new Array();
        for (let file of this.fileList) {
            if (workspaceFolderPath === file.getWorkspaceFolderPath()) filesPath.push(file.getFilePath());
        }
        return filesPath;
    }
    
}

module.exports = {
    FileHandler: FileHandler
}