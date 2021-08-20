'use strict';

const vscode = require('vscode');
const fs = require('fs');
const utils = require('./utils');
const { Cache } = require('./cache');

const scheme = process.env.TEST_SIMPLICITE_SCHEME || 'https'; 
const host = process.env.TEST_SIMPLICITE_HOST || 'gaubert.demo.simplicite.io';
const url = scheme + '://' + host;
const debug = false;

// get those data from input

const businessObjectType = new Map([
    ['adapters', 'Adapter'],
    ['objects', 'ObjectInternal'],
    ['extobjects', 'ObjectExternal'],
    ['commons', 'Script'],
    ['dispositions', 'Disposition'],
    ['workflows', 'BPMProcess'],
]);

const JSON_SAVE_PATH = '/Code/User/globalStorage/simplicite-info.json';

class RequestManager {
    constructor () {
        //this.app = require('simplicite').session({ url: url, debug: debug}); // faire pour chaque objet
        //this.itemCache.push({'obo_name': 'TrnProduct' })
        this.cache = new Cache();
        this.appList = new Map();
    }

    authenticationWithToken (moduleName, app) { // check at the extension start if a token is available in process.env.APPDATA + /Code/User/globalStorage/
        try {
            const token = fs.readFileSync(utils.crossPlatformPath(process.env.APPDATA) + JSON_SAVE_PATH, 'utf-8');
            const infoJSON = JSON.parse(token);
            for (let info of infoJSON) {
                if (info.module === moduleName) app.setAuthToken(info.token);
            }
        } catch (e) {
            console.log('No Token has been found');
            throw 'No Token has been found';
        }
    }

    async authenticationWithCredentials (moduleName, app) {
        try {
            const username = await vscode.window.showInputBox({ 
                placeHolder: 'username', 
                //prompt: 'Please type your username', 
                title: 'Authenticate to ' + moduleName + ' API'
            });
            if (!username) throw 'Authentication cancelled';
            const password = await vscode.window.showInputBox({
                placeHolder: 'password',
                //prompt: 'Please type your password',
                title: 'Authenticate to ' + moduleName + ' API',
                password: true
            });
            if (!password) throw 'Authentication cancelled';
            app.setAuthToken(null);
            app.setUsername(username);
            app.setPassword(password);
        } catch (e) {
            console.log(e);
        }
    }

    // need to change app, create one per project detected and STORE it

    async login (module) {
        let app = require('simplicite').session({ url: module.moduleUrl });
        if (app.authtoken || app.login && app.password) {
            vscode.window.showInformationMessage('Simplicite: Already connected as ' + app.username);
            return false;
        }
        try {
            await this.authenticationWithToken(module.moduleInfo, app);
        } catch (e) {
            await this.authenticationWithCredentials(module.moduleInfo, app);
        }
        app.login().then(res => {
            this.JSONGenerator(res.authtoken);
            vscode.window.showInformationMessage('Simplicite: Logged in as ' + res.login);
        }).catch(err => {
            if (err.status === 401) {
                console.log(err);
                vscode.window.showInformationMessage(err.message, 'Log in').then(click => {
                    if (click == 'Log in') {
                        this.authenticationWithCredentials();
                    }
                })
            } else {
                console.log(err);
                vscode.window.showInformationMessage(err.message);
            }
        });
    }

    handleApp (module) {
        this.appList.forEach(app => {
            
        });
    }

    logout () {
        this.app.logout().then(() => {
            fs.unlinkSync(utils.crossPlatformPath(process.env.APPDATA) + JSON_SAVE_PATH);
            vscode.window.showInformationMessage('Simplicite: Logged out');
        }).catch(err => {
            vscode.window.showInformationMessage(err.message);
        })
    }

    async synchronize (fileList) {
        if (this.app.authtoken) {
            for (let file of fileList) {
                await this.attachFileAndSend(file);
            }
        } else {
            vscode.window.showInformationMessage('You need to be logged to synchronize your file');
        }
    }

    // Called by synchronize
    async attachFileAndSend (file) {
        try { 
            // get fileType and Filename
            const fileType = this.getBusinessObjectType(file);
            let fileName = utils.crossPlatformPath(file.path).split('/');
            fileName = fileName[fileName.length - 1].replaceAll('.java', '');

            // get the item for the update
            let obj = this.app.getBusinessObject(fileType);
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
            });
        } catch (e) {
            console.log(e);
        }   
    }

    async JSONGenerator (token) { // generates a JSON [{"projet": "...", "module": "...", "token": "..."}]
        let preparedJSON = [];
        const simpliciteModules = await utils.getSimpliciteModules();
        for (let module of simpliciteModules) {
            module['token'] = token;
            preparedJSON.push(module);
        }
        this.saveJSONOnDisk(preparedJSON);
    }

    saveJSONOnDisk (preparedJSON) {
        try {
            fs.writeFileSync(utils.crossPlatformPath(process.env.APPDATA) + JSON_SAVE_PATH, JSON.stringify(preparedJSON));
        } catch (e) {
            console.log(e);
        }
    }

    /*async scanModules () {
        const simpliciteModules = await utils.getSimpliciteModules();
    }*/

    getBusinessObjectType (fileName) { // Making the path into an array to find the type which should have the same place in every project: {moduleName}/src/com/simplicite/{type}/{moduleName}/{file}
        const splitFilePath = utils.crossPlatformPath(fileName.path).split('/');
        let returnValue;
        businessObjectType.forEach((value, key) => {
            if (splitFilePath[splitFilePath.length - 3] === key) {
                returnValue = value;
            }
        });
        if (returnValue) return returnValue; 
        throw 'No type has been found';
    }

    getProperScriptField (fileType) {
        switch (fileType) {
            case ('ObjectInternal'):
                return 'obo_script_id';
            case ('ObjectExternal'):
                return 'obe_script_id';
            case ('Adapter'):
                return 'adp_script_id';
            case ('Disposition'):
                return 'dis_script_id';
            case ('Script'):
                return 'scr_file';
            case ('BPMProcess'):
                return 'pcs_file_id';
            default:
                throw ('No field has been found');
        }
    }

    getProperNameField (fileType) {
        switch (fileType) {
            case ('ObjectInternal'):
                return 'obo_name';
            case ('ObjectExternal'):
                return 'obe_name';
            case ('Adapter'):
                return 'adp_name';
            case ('Disposition'):
                return 'dis_code';
            case ('Script'):
                return 'scr_code';
            case ('BPMProcess'):
                return 'pcs_name';
            default:
                throw ('No field has been found');
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

    

    
}

module.exports = {
    RequestManager: RequestManager,
}