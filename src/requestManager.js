'use strict';

const vscode = require('vscode');
const fs = require('fs');
const utils = require('./utils');
//const utils = require('./utils');

const scheme = process.env.TEST_SIMPLICITE_SCHEME || 'https';
const host = process.env.TEST_SIMPLICITE_HOST || 'gaubert.demo.simplicite.io';
const url = scheme + '://' + host;
const debug = false;

const businessObjectType = new Map([
    ['adapters', 'Adapter'],
    ['objects', 'ObjectInternal'],
    ['extobjects', 'ObjectExternal'],
    ['commons', 'Script'],
    ['dispositions', 'Disposition'],
    ['workflows', 'BPMProcess'],
]);

const TOKEN_SAVE_PATH = '/Code/User/globalStorage/token.simplicite';

class RequestManager {
    constructor () {
        this.app = require('simplicite').session({ url: url, debug: debug});
        //this.itemCache.push({'obo_name': "TrnProduct" })
        this.itemCache = new Array;
    }

    authenticationWithToken () { // check at the extension start if a token is available in /Code/User/globalStorage/
        try {
            const token = fs.readFileSync(utils.crossPlatformPath(process.env.APPDATA) + TOKEN_SAVE_PATH);
            this.app.setAuthToken(token);
            this.login();
            return true;
        } catch (e) {
            this.app.setAuthToken(null);
            console.log('No Token has been found');
            return false;
        }
    }

    async authenticationWithCredentials () {
        try {
            const username = await vscode.window.showInputBox({ 
                placeHolder: "username", 
                prompt: "Please type your username", 
                title: "Connecting to Simplicite API"
            });
            if (!username) throw 'Authentication cancelled';
            const password = await vscode.window.showInputBox({
                placeHolder: 'password',
                prompt: 'Please type your password',
                title: "Connecting to Simplicite API",
                password: true
            });
            if (!password) throw 'Authentication cancelled';
            this.app.setUsername(username);
            this.app.setPassword(password);
            this.login();
        } catch (e) {
            console.log(e);
        }
    }

    login () {
        this.app.login().then(res => {
            this.tokenHandler(res.authtoken);
            vscode.window.showInformationMessage('Logged in as ' + res.login);
        }).catch(err => {
            if (err.status === 401) {
                console.log(err);
                vscode.window.showInformationMessage(err.message, 'Sign in').then(click => {
                    if (click = 'Sign in') {
                        this.authenticationWithCredentials();
                    }
                })
            } else {
                vscode.window.showInformationMessage(err.message);
            }
        });
    }

    authenticateCommandRouter () { // Router for command authenticate
        if (this.app.authtoken || this.app.login && this.app.password) this.login();
        else this.authenticationWithCredentials();
    }

    // Called in method login
    tokenHandler (token) {
        this.app.setPassword(null);
        fs.writeFile(utils.crossPlatformPath(process.env.APPDATA) + TOKEN_SAVE_PATH, token, function(err) {
            if(err) {
                console.log(err);
            } else {
                console.log('Token saved');
            }
        });
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
            const fileType = this.getBusinessObjectType(file);
            let obj = this.app.getBusinessObject(fileType);
            let item = this.handleCache(file); // get item from cache NEED TO CHANGE
            let fileName = utils.crossPlatformPath(file.path).split('/');
            fileName = fileName[fileName.length - 1].replaceAll('.java', '');
            if (!item)  { // if not in cache then we get it from API
                item = await this.searchForUpdate(fileName, obj, fileType); 
                this.itemCache.push(item);
            }

            const fieldScriptId = this.getProperScriptField(fileType);       
            let doc = obj.getFieldDocument(fieldScriptId);
            // get the file content for setContent
            const fileContent = await utils.findFiles('**/' + fileName + '.java');
            doc.setContent(fileContent);
            obj.setFieldValue(fieldScriptId, doc);
            obj.update(item, { inlineDocuments: true})
            .then(() => {
                console.log("Object updated");
            }).catch(err => {
                console.log(err);
            })
        } catch (e) {
            console.log(e);
        }
        
    }

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
        let list = await obj.search({ [this.getProperNameField(fileType)]: fileName }) // add cache here
        if (list.length >= 2) throw 'More than one object has been returned with the name ' + fileName;
        let item = await obj.getForUpdate(list[0].row_id, { inlineDocuments: true });
        return item;
    }

    handleCache (currentItem) {
        let value = false;
        this.itemCache.forEach(iCache => {
            if (iCache === currentItem) {
                value = iCache;
                return;
            }
        });
        return value;
    }

    
}

module.exports = {
    RequestManager: RequestManager,
}