'use strict';

const vscode = require('vscode');
const fs = require('fs');
var parseString = require('xml2js').parseStringPromise;

class FileHandler {
    constructor () {
        this.TOKEN_SAVE_PATH = this.crossPlatformPath(require('./constant').TOKEN_SAVE_PATH);
        this.FILES_SAVE_PATH = this.crossPlatformPath(require('./constant').FILES_SAVE_PATH);
        this.fileList = new Array();
    }

    async simpliciteInfoGenerator (token, appURL) { // generates a JSON [{"projet": "...", "module": "...", "token": "...", "isConnected": "..."}]
        let preparedJSON = new Array();
        const simpliciteModules = await this.getSimpliciteModules();
        for (let module of simpliciteModules) {
            if (module.moduleUrl === appURL && !module.token) { // only set the token for the object coming from the same instance => same token 
                module['token'] = token;  
                preparedJSON = preparedJSON.concat([module]);
            } else {
                preparedJSON = preparedJSON.concat([module]);   
            }
        }
        preparedJSON = this.getTokenFromSimpliciteInfo(preparedJSON);
        this.saveJSONOnDisk(preparedJSON, this.TOKEN_SAVE_PATH);
    }

    getTokenFromSimpliciteInfo (preparedJSON) {
        try {
            const token = fs.readFileSync(this.TOKEN_SAVE_PATH, 'utf8');
            const infoJSON = JSON.parse(token);
            for (let info of infoJSON) {
                for (let prepared of preparedJSON) {
                    if (prepared.moduleInfo === info.moduleInfo && info.token && !prepared.token) {
                        prepared.token = info.token;
                    }
                }
            }
            return preparedJSON;
        } catch(e) {
            console.log(e.message);
        }
        return preparedJSON;
    }

    saveJSONOnDisk (preparedJSON, path) {
        try {
            fs.writeFileSync(path, JSON.stringify(preparedJSON));
        } catch (e) {
            console.log(e.message);
        }
    }

    deleteSimpliciteInfo () {
        try {
            fs.unlinkSync(this.TOKEN_SAVE_PATH);
        } catch (e) {
            console.log(e.message);
        }
    }

    deleteModuleJSON (moduleInfo) {
        let simpliciteInfo = this.getSimpliciteInfo();
        try {
            simpliciteInfo = JSON.parse(simpliciteInfo);
            let newInfo = [];
            for (let moduleJSON of simpliciteInfo) {
                if (moduleJSON['moduleInfo'] !== moduleInfo) {
                    newInfo.push(moduleJSON);
                }
            }
            this.saveJSONOnDisk(newInfo, this.TOKEN_SAVE_PATH);
        } catch (e) {
            throw e.message;
        }
        
    }

    getSimpliciteInfo () {
        try {
            return fs.readFileSync(this.TOKEN_SAVE_PATH, 'utf8');
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
                foundFile.push(this.readFileSync(this.crossPlatformPath(file.fsPath), 'utf8' ));
            } catch(err) {
                console.log(err.message);
            }
        };
        return foundFile;
    };

    async getSimpliciteModules () { // returns the list of the folders detected as simplicite modules
        let simpliciteWorkspace = new Array();
        try {
            for (let workspaceFolder of vscode.workspace.workspaceFolders) {
                const globPatern = '**/module-info.json'; // if it contains module-info.json -> simplicite module
                const relativePattern = new vscode.RelativePattern(workspaceFolder, globPatern);
                const moduleInfo = await this.findFiles(relativePattern);
                //if (moduleInfo.length >= 2) console.log('Warning: More than two modules has been found with the same name');
                if (moduleInfo.length === 0) throw 'No module found';
                const moduleUrl = await this.getModuleUrl(workspaceFolder);
                if (moduleInfo[0]) simpliciteWorkspace.push({ moduleInfo: JSON.parse(moduleInfo[0]).name, workspaceFolder: workspaceFolder.name, workspaceFolderPath: this.crossPlatformPath(workspaceFolder.uri.path), moduleUrl: moduleUrl });
            }
            
        } catch (e) {
            console.log(e.message ? e.message : e);
        }
        return simpliciteWorkspace;
    }

    getModuleUrl (workspaceFolder) { // searches into pom.xml and returns the simplicite's instance url
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

    async setfileList (modules, uri) {
        return new Promise(async (resolve, reject) => {
            try {
                for (let module of modules) {
                    const filePath = this.crossPlatformPath(uri.path);
                    const filePathLowerCase = filePath;
                    const workspaceLowerCase = module.workspaceFolderPath;

                    if (filePathLowerCase.toLowerCase().search(workspaceLowerCase.toLowerCase()) !== -1) {
                        const fileObject = { filePath: filePath, instanceUrl: module.moduleUrl, workspaceFolderPath: module.workspaceFolderPath};
                        if (!this.isFileInFileList(filePath)) {
                            this.fileList.push(fileObject);
                            console.log(`Change detected on ${filePath}`);
                        }
                    }
                }
                this.saveModifiedFiles();
                resolve();
            } catch (e) {
                console.log(e);
                reject();
            }
        })
    }

    saveModifiedFiles () {
        let preparedJSON = new Array();
        for (let file of this.fileList) {
            preparedJSON.push(file);
        }
        this.saveJSONOnDisk(preparedJSON, this.FILES_SAVE_PATH);
    }

    getModifiedFilesOnStart () {
        try {
            this.fileList = require(this.FILES_SAVE_PATH);
        } catch (e) {
            console.log('simplicite-file.json not found');
        }
    }

    readModifiedFiles () {
        try {
            return this.readFileSync(this.FILES_SAVE_PATH);
        } catch (e) {
            throw e.message;
        }
    }

    deleteModifiedFiles () {
        try {
            fs.unlinkSync(this.FILES_SAVE_PATH);
        } catch (e) {
            console.log(e.message);
        }
    }

    isFileInFileList (filePath) {
        for (let fileListelement of this.fileList) {
            if (fileListelement.filePath === filePath) return true; 
        }
        return false;
    }

    getOnlyFilesPath (workspaceFolderPath) {
        let filesPath = new Array();
        for (let file of this.fileList) {
            if (workspaceFolderPath === file.workspaceFolderPath) filesPath.push(file.filePath);
        }
        return filesPath;
    }

    crossPlatformPath (path) {
        if (process.platform !== 'win32') return path;
        if (path[0] === '/' || path[0] === '\\') path = path.slice(1);
        return path.replaceAll('\\', '/');
    }
}

module.exports = {
    FileHandler: FileHandler
}