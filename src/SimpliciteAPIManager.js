'use strict';

const vscode = require('vscode');
const utils = require('./utils');
const { Cache } = require('./cache');

class SimpliciteAPIManager {
    constructor (fileHandler) {
        this.cache = new Cache();
        this.appList = new Map(); // Map (url, app), one entry for one instance (ex: one entry = one simplicite instance)
        this.moduleURLList = new Array(); // Contains the urls of the instances we are connected to
        this.devInfo = null;
        this.fileHandler = fileHandler;
        
    }

    async getDevInfo (app) { // uses the first instance available to fetch the data
        try {
            this.devInfo = await app.getDevInfo();
        } catch(e) {
            console.log(e);
        }
    }

    login (module) {  
        return new Promise(async (resolve, reject) => {
             // handleApp returns the app correct instance (one for every simplicite instance)
            const app = await this.handleApp(module.moduleUrl);
            // if the user's not connected, reject
            if (app.authtoken || app.login && app.password) {
                vscode.window.showInformationMessage('Simplicite: Already connected as ' + app.username);
                reject();
            }   
            try {
                await this.authenticationWithToken(module.moduleInfo, app);
            } catch (e) {
                console.log(e);
                await this.authenticationWithCredentials(module.moduleInfo, app);
            }
            this.setApp(module.moduleUrl, app);
            app.login().then(async res => {
                if (!this.devInfo) await this.getDevInfo(app);
                await this.fileHandler.simpliciteInfoGenerator(res.authtoken, app.parameters.url); // if logged in we write a JSON with token etc... for persistence
                vscode.window.showInformationMessage('Simplicite: Logged in as ' + res.login + ' at: ' + app.parameters.url);
                if (!this.moduleURLList.includes(module.moduleUrl)) this.moduleURLList.push(module.moduleUrl);
                resolve();
            }).catch(err => {
                if (err.status === 401) {
                    console.log(err);
                    vscode.window.showInformationMessage(err.message, 'Log in').then(click => {
                        if (click === 'Log in') {
                            this.login(module);
                            
                        }
                    })
                } else {
                    console.log(err);
                    vscode.window.showInformationMessage(err.message);
                }
                reject();
            });
        })
    }

    authenticationWithToken (moduleName, app) { // check at the extension start if a token is available in process.env.APPDATA + /Code/User/globalStorage/
        console.log('Connect with token');
        const token = this.fileHandler.getSimpliciteInfo();
        const infoJSON = JSON.parse(token);
        for (let info of infoJSON) {
            if (info.moduleInfo === moduleName) app.setAuthToken(info.token); // condition may have to change
        }
        if (!app.authtoken) {
            throw 'No token has been set';
        }
    }

    async authenticationWithCredentials (moduleName, app) {
        console.log('Connect with credentials');
        try {
            const username = await vscode.window.showInputBox({ 
                placeHolder: 'username',  
                title: 'Simplicite: Authenticate to ' + moduleName + ' API (' + app.parameters.url +')'
            });
            if (!username) throw 'Authentication cancelled';
            const password = await vscode.window.showInputBox({
                placeHolder: 'password',
                title: 'Simplicite: Authenticate to ' + moduleName + ' API (' + app.parameters.url +')',
                password: true
            });
            if (!password) throw 'Authentication cancelled';
            app.setUsername(username);
            app.setPassword(password);
        } catch (e) {
            console.log(e);
        }
    }

    logout () {
        try {
            this.fileHandler.deleteSimpliciteInfo();
        } catch (e) {
            console.log(e);
        }
        let i = 0;
        this.appList.forEach((app) => {
            i++;
            app.logout().then((res) => {
                vscode.window.showInformationMessage('Simplicite: ' + res.result + ' from: ' + app.parameters.url);        
            }).catch(e => {
                vscode.window.showInformationMessage(e.message);        
            })
        })
        this.appList = new Map();
        this.moduleURLList = new Array();
    }  

    async synchronizeHandler (fileList, modules) { // 
        try {
            const notConnectedModule = this.beforeSynchronization(fileList);
            this.bindFileWithModule(fileList);
        } catch(e) {
            console.log(e);
        }
        
        /*const app = await this.handleApp(module.moduleUrl);
        // get token
        try {
            const token = this.fileHandler.getSimpliciteInfo();
            const infoJSON = JSON.parse(token);
            for (let info of infoJSON) {
                if (info.moduleInfo === module.moduleInfo) app.setAuthToken(info.token);
            }
            if (app.authtoken) {        
                await this.attachFileAndSend(file, app);
            } else {
                vscode.window.showInformationMessage('Simplicite: You need to be logged to synchronize your file');
            }
            return true;
        } catch(e) {
            console.log(e);
            return false;
        }   */
    }

    beforeSynchronization (fileList) {
        if (fileList.length === 0) {
            throw 'No file has changed';
        } else if (this.moduleURLList.length === 0) {
            throw 'No module connected';
        } else {
            return this.checkModuleConnexion(fileList);
        }
    }

    checkModuleConnexion (fileList) {
        let notConnectedModule = new Array();
        for (let file of fileList) {
            if (!this.moduleURLList.includes(file.instanceUrl) && !notConnectedModule.includes(file.instanceUrl)) {
                notConnectedModule.push(file.instanceUrl);
            }
        }
        return notConnectedModule;
    }

    bindFileWithModule (fileList) {
        let fileModule = new Map();
        for (let file of fileList) {
            if (this.moduleURLList.includes(file.instanceUrl)) {
                fileModule.set({

                })
            }
        }
    }

    connectedInstance () {
        for (let url of this.moduleURLList) {
            vscode.window.showInformationMessage('Simplicite: you are connected to: ' + url);     
        }
    }

    async synchronize (file, module) {

    }

    // Called by synchronize
    async attachFileAndSend (file, app) {
        try { 
            // get fileType and Filename
            const fileType = this.getBusinessObjectType(file.filePath);
            let fileName = this.fileHandler.crossPlatformPath(file.filePath).split('/');
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
            });
        } catch (e) {
            console.log(e);
        }   
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
            if (this.appList[moduleURL] === undefined) {
                this.appList.set(moduleURL, require('simplicite').session({ url: moduleURL }));
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
}

module.exports = {
    SimpliciteAPIManager: SimpliciteAPIManager,
}