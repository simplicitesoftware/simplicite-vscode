'use strict';

const vscode = require('vscode');
const fs = require('fs');
var parseString = require('xml2js').parseStringPromise;
const simpleGit = require('simple-git/promise');

class FileHandler {
    constructor () {
        this.JSON_SAVE_PATH = this.crossPlatformPath(require('./constant').JSON_SAVE_PATH);
        this.fileList = new Array();
    }

    async simpliciteInfoGenerator (token, appURL) { // generates a JSON [{"projet": "...", "module": "...", "token": "...", "isConnected": "..."}]
        let preparedJSON = new Array();
        const simpliciteModules = await this.getSimpliciteModules();
        for (let module of simpliciteModules) {
            delete module.simpleGit;
            if (module.moduleUrl === appURL && !module.token) { // only set the token for the object coming from the same instance => same token 
                module['token'] = token;  
                preparedJSON = preparedJSON.concat([module]);
            } else {
                preparedJSON = preparedJSON.concat([module]);   
            }
        }
        preparedJSON = this.getTokenFromSimpliciteInfo(preparedJSON);
        this.saveSimpliciteInfoOnDisk(preparedJSON);
    }

    getTokenFromSimpliciteInfo (preparedJSON) {
        try {
            const token = fs.readFileSync(this.JSON_SAVE_PATH, 'utf8');
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

    saveSimpliciteInfoOnDisk (preparedJSON) {
        try {
            fs.writeFileSync(this.JSON_SAVE_PATH, JSON.stringify(preparedJSON));
        } catch (e) {
            console.log(e.message);
        }
    }

    deleteSimpliciteInfo () {
        try {
            fs.unlinkSync(this.JSON_SAVE_PATH);
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
            this.saveSimpliciteInfoOnDisk(newInfo);
        } catch (e) {
            throw e.message;
        }
        
    }

    getSimpliciteInfo () {
        try {
            return fs.readFileSync(this.JSON_SAVE_PATH, 'utf8');
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
                foundFile.push(this.readFileSync(this.crossPlatformPath(file.path), { encoding: 'utf8' }));
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
                const moduleUrl = await this.getModuleUrl(workspaceFolder);
                if (moduleInfo[0]) simpliciteWorkspace.push({ moduleInfo: JSON.parse(moduleInfo[0]).name, workspaceFolder: workspaceFolder.name, workspaceFolderPath: this.crossPlatformPath(workspaceFolder.uri.path), moduleUrl: moduleUrl, simpleGit: simpleGit(this.crossPlatformPath(workspaceFolder.uri.path))});
            }
            
        } catch (err) {
            console.log(err);
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

    async setfileList (modules) {
        try {
            this.fileList = new Array();
            for (let module of modules) {
                const diffSummary = await module.simpleGit.diffSummary();
                for (let {file} of diffSummary.files) {
                    if (file.search('.java') !== -1) this.fileList.push({ filePath: file, instanceUrl: module.moduleUrl, workspaceFolderPath: module.workspaceFolderPath});	
                }
            }
        } catch (e) {
            console.log(e);
        }
    }
//workspaceFolderPath: 'D:/repo/Github/SimpliciteSharing/DemoVueJS'
    async handleGit (modules) {
        for (let module of modules) {
            try {
                await module.simpleGit.add(this.getOnlyFilesPath(module.workspaceFolderPath));
                const commitMessage = 'test made the ' + Date();
                console.log(commitMessage);
                //await module.simpleGit.commit(commitMessage);
            } catch (e) {
                console.log(e);
            }
        }
    }

    getOnlyFilesPath (workspaceFolderPath) {
        let filesPath = new Array();
        for (let file of this.fileList) {
            if (workspaceFolderPath === file.workspaceFolderPath) filesPath.push(file.filePath);
        }
        return filesPath;
    }

    crossPlatformPath (path) {
        if (path[0] === '/' || path[0] === '\\') path = path.slice(1);
        return path.replaceAll('\\', '/');
    }
}

module.exports = {
    FileHandler: FileHandler
}