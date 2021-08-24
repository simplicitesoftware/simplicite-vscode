'use strict';

const vscode = require('vscode');
const fs = require('fs');
const utils = require('./utils');
const { Cache } = require('./cache');
const JSON_SAVE_PATH = utils.crossPlatformPath(require('./constant').JSON_SAVE_PATH);

const businessObjectType = new Map([
    ['adapters', 'Adapter'],
    ['objects', 'ObjectInternal'],
    ['extobjects', 'ObjectExternal'],
    ['commons', 'Script'],
    ['dispositions', 'Disposition'],
    ['workflows', 'BPMProcess'],
]);



class RequestManager {
    constructor () {
        this.cache = new Cache();
        this.appList = new Map(); // Map (url, app), one entry for one instance (ex: one entry = one simplicite instance)
        this.devInfo = null;
    }

    async getDevInfo (app) { // uses the first instance available to fetch the data
        try {
            this.devInfo = await app.getDevInfo();
        } catch(e) {
            console.log(e);
        }
    }

    login (module, moduleURLList) {  
        return new Promise(async (resolve, reject) => {
             // handleApp returns the app correct instance (one for every simplicite instance)
            const app = await this.handleApp(module.moduleInfo, module.moduleUrl, moduleURLList);
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
                await this.JSONGenerator(res.authtoken, app.parameters.url); // if logged in we write a JSON with token etc... for persistence
                vscode.window.showInformationMessage('Simplicite: Logged in as ' + res.login + ' at: ' + app.parameters.url);
                resolve();
            }).catch(err => {
                if (err.status === 401) {
                    console.log(err);
                    vscode.window.showInformationMessage(err.message, 'Log in').then(click => {
                        if (click == 'Log in') {
                            this.login(module, moduleURLList);
                            
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
        const token = fs.readFileSync(JSON_SAVE_PATH, 'utf-8');
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
            fs.unlinkSync(JSON_SAVE_PATH);
        } catch (e) {
            console.log(e);
        }
        this.appList.forEach((app) => {
            app.logout().then((res) => {
                vscode.window.showInformationMessage('Simplicite: ' + res.result);        
            }).catch(e => {
                vscode.window.showInformationMessage(e.message);        
            })
        })
    }  

    

    async JSONGenerator (token, appURL) { // generates a JSON [{"projet": "...", "module": "...", "token": "..."}]
        let preparedJSON = new Array();
        const simpliciteModules = await utils.getSimpliciteModules();
        for (let module of simpliciteModules) {
            if (module.moduleUrl === appURL && !module.isConnected) { // only set the token for the object coming from the same instance => same token
                module.isConnected = true;
                module['token'] = token;  
                preparedJSON = preparedJSON.concat([module]);
            } else {
                preparedJSON = preparedJSON.concat([module]);   
            }
        }
        preparedJSON = this.getTokenFromJSON(preparedJSON);
        this.saveJSONOnDisk(preparedJSON);
    }

    getTokenFromJSON (preparedJSON) {
        try {
            const token = fs.readFileSync(JSON_SAVE_PATH, 'utf-8');
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
            console.log(e);
        }
        return preparedJSON;
    }

    saveJSONOnDisk (preparedJSON) {
        try {
            fs.writeFileSync(JSON_SAVE_PATH, JSON.stringify(preparedJSON));
        } catch (e) {
            console.log(e);
        }
    }

    

    async synchronize (file, module, moduleURLList) { // 
        const app = await this.handleApp(module.moduleInfo, module.moduleUrl, moduleURLList);
        // get token
        try {
            const token = fs.readFileSync(JSON_SAVE_PATH, 'utf-8');
            const infoJSON = JSON.parse(token);
            for (let info of infoJSON) {
                if (info.moduleInfo === module.moduleInfo) app.setAuthToken(info.token);
            }
            if (app.authtoken) {        
                await this.attachFileAndSend(file, app);
            } else {
                vscode.window.showInformationMessage('Simplicite: You need to be logged to synchronize your file');
            }
        } catch(e) {
            console.log(e);
        }
        
        
    }

    // Called by synchronize
    async attachFileAndSend (file, app) {
        try { 
            // get fileType and Filename
            const fileType = this.getBusinessObjectType(file);
            let fileName = utils.crossPlatformPath(file.filePath).split('/');
            fileName = fileName[fileName.length - 1].replaceAll('.java', '');

            // get the item for the update
            let obj = app.getBusinessObject(fileType);
            let item = await this.searchForUpdate(fileName, obj, fileType); 
            
            // give the field, ex: obo_script_id, scr_file
            const fieldScriptId = this.getProperScriptField(fileType);       
            let doc = obj.getFieldDocument(fieldScriptId);
            // get the file content for setContent
            const fileContent = await utils.findFiles('**/' + fileName + '.java');
            if (fileContent.length >= 2) throw 'More than one file has been found';
            doc.setContent(fileContent[0]);
            obj.setFieldValue(fieldScriptId, doc);
            obj.update(item, { inlineDocuments: true})
            .then(() => {
                console.log('Object updated');
            }).catch(e => {
                console.log(e);
            });
        } catch (e) {
            console.log(e);
        }   
    }

    async searchForUpdate (fileName, obj, fileType) {
        if (!this.cache.isInCache(fileName)) {
            const properNameField = this.getProperNameField(fileType)   
            let list = await obj.search({[properNameField]: fileName })
            if (list.length >= 2) throw 'More than one object has been returned with the name ' + fileName;
            this.cache.addPair(fileName, list[0].row_id);
        }
        let row_id = this.cache.getListFromCache(fileName);
        let item = await obj.getForUpdate(row_id, { inlineDocuments: true });
        return item;
    }
    
    handleApp (moduleName, moduleURL, moduleURLList) { 
        return new Promise((resolve) => {
            if (this.appList[moduleName] === undefined && !utils.isUrlConnected(moduleURL, moduleURLList)) {
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
            if (fileType === object.object) return object.field;
        }
    }

    getProperNameField (fileType) {
        console.log(this.devInfo.objects);
        for (let object of this.devInfo.objects) {
            if (fileType === object.object) return object.keyfield;
        }
    }

    getBusinessObjectType (fileName) { // Making the path into an array to find the type which should have the same place in every project: {moduleName}/src/com/simplicite/{type}/{moduleName}/{file}
        const splitFilePath = utils.crossPlatformPath(fileName.filePath).split('/');
        let returnValue;
        businessObjectType.forEach((value, key) => {
            if (splitFilePath[splitFilePath.length - 3] === key) {
                returnValue = value;
            }
        });
        if (returnValue) return returnValue; 
        throw 'No type has been found';
    }

}

module.exports = {
    RequestManager: RequestManager,
}