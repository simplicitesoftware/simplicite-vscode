'use strict';

const vscode = require('vscode');
const { Cache } = require('./cache');
const { BarItem } = require('./BarItem');
const { FileHandler } = require('./FileHandler');

class SimpliciteAPIManager {
    constructor () {
        this.cache = new Cache();
        this.appList = new Map(); // Map (url, app), one entry for one instance (ex: one entry = one simplicite instance)
        this.moduleURLList = new Array(); // Contains the urls of the instances we are connected to
        this.devInfo = null;
        this.fileHandler = new FileHandler();  
        this.barItem = new BarItem(vscode, 'Simplicité');
    }

    async loginHandler (modules) {
        if (modules.length > 0) {
            for (let module of modules) {
                try {
                    await this.loginTokenOrCredentials(module);
                    this.barItem.show(this.fileHandler.fileList, modules, this.moduleURLList);
                } catch (e) {
                    vscode.window.showErrorMessage(e.message ? e.message : e);
                }
            }
        } else {
            vscode.window.showInformationMessage('Simplicite: No Simplicite module has been found');
        }
    }

    async loginTokenOrCredentials (module) {
        const app = await this.handleApp(module.moduleUrl); // handleApp returns the app correct instance (one for every simplicite instance)
        try {
            this.authenticationWithToken(module.moduleInfo, app);
            await this.login(module, app);
        } catch (e) {
            await this.authenticationWithCredentials(module.moduleInfo, app);
            await this.login(module, app);
        }
    }

    login (module, app) {
        return new Promise(async (resolve, reject) => {                            
            app.login().then(async res => {
                if (!this.devInfo) await this.getDevInfo(app);
                await this.fileHandler.simpliciteInfoGenerator(res.authtoken, app.parameters.url); // if logged in we write a JSON with token etc... for persistence
                if (!this.moduleURLList.includes(module.moduleUrl)) this.moduleURLList.push(module.moduleUrl);
                this.setApp(module.moduleUrl, app);
                vscode.window.showInformationMessage('Simplicite: Logged in as ' + res.login + ' at: ' + app.parameters.url);
                resolve();
            }).catch(err => {
                app.setAuthToken(null);
                app.setPassword(null);
                app.setUsername(null);
                return reject(err.message);
            });
        })
    }

    authenticationWithToken (moduleName, app) { // check if a token is available in process.env.APPDATA + /Code/User/globalStorage/simplicite-info.json  
        try {
            const token = this.fileHandler.getSimpliciteInfo();
            const infoJSON = JSON.parse(token);
            for (let info of infoJSON) {
                if (info.moduleInfo === moduleName && info.token) {
                    app.setAuthToken(info.token);
                }
            }
        } catch(e) {
            throw e;
        }     
    }

    async authenticationWithCredentials (moduleName, app) {
        try {
            const username = await vscode.window.showInputBox({ 
                placeHolder: 'username',
                title: 'Simplicite: Authenticate to ' + moduleName + ' API (' + app.parameters.url +')'
            });
            if (!username) throw 'Simplicite: Authentication cancelled';
            const password = await vscode.window.showInputBox({
                placeHolder: 'password',
                title: 'Simplicite: Authenticate to ' + moduleName + ' API (' + app.parameters.url +')',
                password: true
            });
            if (!password) throw 'Simplicite: Authentication cancelled';
            app.setPassword(password);
            app.setUsername(username);
        } catch (e) {
            throw e;
        }
    }

    logout () {
        this.fileHandler.deleteSimpliciteInfo();
        this.appList.forEach((app) => {
            app.logout().then((res) => {
                this.appList = new Map();
                this.moduleURLList = new Array();
                vscode.window.showInformationMessage('Simplicite: ' + res.result + ' from: ' + app.parameters.url);        
            }).catch(e => {
                vscode.window.showErrorMessage(e.message ? e.message : e);        
            })
        })
        if (this.appList.size === 0) vscode.window.showInformationMessage('Simplicite: You are not connected to any module');       
    }
    
    async specificLogout(modules, moduleName) {
        const self = this;
        try {
            const moduleUrl = this.getModuleUrlFromName(modules, moduleName);
            const app = await this.handleApp(moduleUrl);
            app.logout().then((res) => {
                self.fileHandler.deleteModuleJSON(moduleName);
                self.appList.delete(moduleUrl);
                const index = self.moduleURLList.indexOf(moduleUrl);
                self.moduleURLList.splice(index, 1);
                this.barItem.show(this.fileHandler.fileList, modules, this.moduleURLList);
                vscode.window.showInformationMessage('Simplicite: ' + res.result + ' from: ' + app.parameters.url);
            }).catch(e => {
                if (e.status === 401 || e.code === 'ECONNREFUSED') {
                    vscode.window.showErrorMessage(`Simplicite: You are not connected to ${moduleName}`);
                } else {
                    vscode.window.showErrorMessage(e.message);
                }
            });
        } catch (e) {
            vscode.window.showErrorMessage(e.message);
        }
    }

    async applyChangesHandler () { // 
        return new Promise(async (resolve, reject) => {
            try {
                this.beforeApply(this.fileHandler.fileList);
                const fileModule = this.bindFileWithModule(this.fileHandler.fileList);
                let numberOfErrors = 0;
                for (let connectedModule of this.moduleURLList) {
                    const app = await this.handleApp(connectedModule);
                    if (!fileModule[connectedModule]) continue; 
                    for (let filePath of fileModule[connectedModule]) {
                        try {
                            await this.attachFileAndSend(filePath, app);
                        } catch (e) {
                            vscode.window.showErrorMessage(`Simplicite: Error sending ${filePath} \n ${e.message ? e.message : e}`);
                            console.log(`Error in attachFileAndSend: ${e}`);
                            numberOfErrors++;
                        }
                    }
                }
                const fileListLength = this.fileHandler.fileList.length
                if (numberOfErrors === fileListLength) {
                    vscode.window.showInformationMessage('Simplicite: Cannot apply any change');
                } else {
                    vscode.window.showInformationMessage(`Simplicite: Changed ${fileListLength - numberOfErrors} files over ${fileListLength}`);
                    this.fileHandler.deleteModifiedFiles();
                    this.fileHandler.fileList = new Array();
                }
                resolve();
            } catch(e) {
                return reject(e);
            }
        });    
    }

    beforeApply (fileList) {
        if (this.moduleURLList.length === 0) {
            throw 'Simplicite: No module connected';
        } else if (fileList.length === 0) {
            throw 'Simplicite: No file has changed';
        };
    }

    bindFileWithModule (fileList) {
        let flag = false;
        let fileModule = {};
        for (let {instanceUrl, filePath} of fileList) {
            if (this.moduleURLList.includes(instanceUrl)) { 
                fileModule[instanceUrl] ? fileModule[instanceUrl].push(filePath) : fileModule[instanceUrl] = [filePath];                 
                flag = true;
            }
        }
        if (!flag) throw 'Simplicite: Module not connected, check the connected instances';
        return fileModule;
    }

    // Called by synchronize
    async attachFileAndSend (filePath, app) {
        return new Promise(async (resolve, reject) => {
            try { 
                // get fileType and Filename
                const fileType = this.getBusinessObjectType(filePath);
                let fileName = this.fileHandler.crossPlatformPath(filePath).split('/');
                fileName = fileName[fileName.length - 1].replaceAll('.java', '');
    
                // get the item for the update
                let obj = app.getBusinessObject(fileType);
                const properNameField = this.getProperNameField(fileType);
                let item = await this.searchForUpdate(fileName, obj, properNameField); 
                
                // give the field, ex: obo_script_id, scr_file
                const fieldScriptId = this.getProperScriptField(fileType);       
                let doc = obj.getFieldDocument(fieldScriptId);

                // get the file content for setContent
                const fileContent = await this.fileHandler.findFiles('**/' + fileName + '.java');
                if (fileContent.length >= 2) throw 'More than one file has been found';
                doc.setContentFromText(fileContent[0]);
                obj.setFieldValue(fieldScriptId, doc);
                obj.update(item, { inlineDocuments: true})
                .then(res => {
                    console.log(res[properNameField] + ' updated');
                    resolve();
                });
            } catch (e) {
                return reject(e);
            }   
        })
        
    }

    async searchForUpdate (fileName, obj, properNameField) {
        if (!this.cache.isInCache(fileName)) {
            let list = await obj.search({[properNameField]: fileName })
            if (list.length >= 2) throw 'More than one object has been returned with the name ' + fileName;
            if (list.length === 0) throw 'No object has been returned';
            this.cache.addPair(fileName, list[0].row_id);
        }
        let row_id = this.cache.getListFromCache(fileName);
        let item = await obj.getForUpdate(row_id, { inlineDocuments: true });
        return item;
    }
    
    handleApp (moduleURL) { 
        return new Promise((resolve) => {
            if (this.appList.get(moduleURL) === undefined) {
                this.setApp(moduleURL, require('simplicite').session({ url: moduleURL }));
            }
            resolve(this.appList.get(moduleURL));
        });
    }

    setApp (moduleURL, app) {
        this.appList.set(moduleURL, app);
    }

    getProperScriptField (fileType) {
        for (let object of this.devInfo.objects) {
            if (fileType === object.object) {
                return object.sourcefield;
            }
        }
    }

    getProperNameField (fileType) {
        for (let object of this.devInfo.objects) {
            if (fileType === object.object) return object.keyfield;
        }
    }

    // Change path into Java package modele to find object type with dev info
    getBusinessObjectType (fileName) { 
        let urlForPackageComparaison;
        fileName.includes('/') ? urlForPackageComparaison = fileName.replaceAll('/', '.') : urlForPackageComparaison = fileName.replaceAll('\\', '.'); 
        for (let object of this.devInfo.objects) {
            if (urlForPackageComparaison.includes(object.package)) return object.object;
        }
        throw 'No type has been found';
    }
    
    async getDevInfo (app) { // uses the first instance available to fetch the data
        try {
            this.devInfo = await app.getDevInfo();
        } catch(e) {
            console.log(e);
        }
    }

    getModuleUrlFromName (modules, moduleName) {
        for (let module of modules) {
            if (module.moduleInfo === moduleName) {
                return module.moduleUrl;
            }
        }
    }

    connectedInstance () {
        if (this.moduleURLList.length === 0) {
            vscode.window.showInformationMessage('Simplicite: No connected instance');     
        }
        for (let url of this.moduleURLList) {
            vscode.window.showInformationMessage('Simplicite: You are connected to: ' + url);     
        }
    }
}

module.exports = {
    SimpliciteAPIManager: SimpliciteAPIManager,
}