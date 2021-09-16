'use strict';

const { window, commands, workspace, RelativePattern } = require('vscode');
const { Cache } = require('./Cache');
const { BarItem } = require('./BarItem');
const { FileHandler } = require('./FileHandler');
const { crossPlatformPath } = require('./utils');
const { AppHandler } = require('./classIndex');
const { ModuleHandler } = require('./ModuleHandler');
const logger = require('./Log');

class SimpliciteAPIManager {
    constructor () {
        this.cache = new Cache();
        this.devInfo = null;  
        this.moduleDevInfo = null;
        this.barItem = new BarItem('Simplicité');
        this.appHandler = new AppHandler();
        this.fileHandler = new FileHandler();
        this.moduleHandler = new ModuleHandler();
    }

    async init (context, request) {
        await this.barItem.init(context, request);
        await this.moduleHandler.setModules(await this.fileHandler.getSimpliciteModules());
    }

    async loginHandler () {
        return new Promise (async (resolve, reject) => {
            if (this.moduleHandler.moduleLength() > 0) {
                for (let module of this.moduleHandler.getModules()) {
                    try { 
                        await this.loginTokenOrCredentials(module);
                        this.barItem.show(this.fileHandler.fileList, this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
                    } catch (e) {
                        window.showErrorMessage(`${e}`);
                        logger.error(e);
                        reject();
                    }
                }
                resolve();
            } else {
                window.showInformationMessage('Simplicite: No Simplicite module has been found');
                reject();
            }
        })
        
    }

    async loginTokenOrCredentials (module) {
        const app = await this.appHandler.getApp(module.getInstanceUrl()); // handleApp returns the app correct instance (one for every simplicite instance)
        try {
            await this.authenticationWithToken(module.getName(), app);
            await this.login(module.getInstanceUrl(), app);
        } catch (e) {
            try {
                await this.authenticationWithCredentials(module.getName(), app);
                await this.login(module.getInstanceUrl(), app);
            } catch (e) {
                throw e;
            }
        }
    }
    /** */
    login (moduleInstanceUrl, app) {
        return new Promise(async (resolve, reject) => {                            
            app.login().then(async res => {
                if (!this.devInfo) await this.getDevInfo(app);
                await this.fileHandler.simpliciteInfoGenerator(res.authtoken, app.parameters.url); // if logged in we write a JSON with connected modules objects;
                this.moduleHandler.spreadToken(moduleInstanceUrl, res.authtoken);
                this.appHandler.setApp(moduleInstanceUrl, app);
                window.showInformationMessage('Simplicite: Logged in as ' + res.login + ' at: ' + app.parameters.url);
                logger.info('Logged in as ' + res.login + ' at: ' + app.parameters.url);
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
            const moduleArray = this.fileHandler.getSimpliciteInfoContent();
            for (let module of moduleArray) {
                if (module.name === moduleName && module.token) {
                    app.setAuthToken(module.token);
                }
            }
        } catch(e) {
            throw e;
        }     
    }

    async authenticationWithCredentials (moduleName, app) {
        try {
            const username = await window.showInputBox({ 
                placeHolder: 'username',
                title: 'Simplicite: Authenticate to ' + moduleName + ' API (' + app.parameters.url +')'
            });
            if (!username) throw '';
            const password = await window.showInputBox({
                placeHolder: 'password',
                title: 'Simplicite: Authenticate to ' + moduleName + ' API (' + app.parameters.url +')',
                password: true
            });
            if (!password) throw '';
            app.setPassword(password);
            app.setUsername(username);
        } catch (e) {
            throw e;
        }
    }

    logout () {
        this.fileHandler.deleteSimpliciteInfo();
        this.appHandler.getAppList().forEach((app) => {
            app.logout().then((res) => {
                this.appHandler.setAppList(new Map());
                this.moduleHandler.spreadToken(app.parameters.url, null);
                window.showInformationMessage('Simplicite: ' + res.result + ' from: ' + app.parameters.url);
                logger.info(res.result + ' from: ' + app.parameters.url);        
            }).catch(e => {
    			logger.error(e);
                window.showErrorMessage(e.message ? e.message : e);        
            })
        })
        if (this.appHandler.getAppList().size === 0) window.showInformationMessage('Simplicite: You are not connected to any module');       
    }
    
    async specificLogout(input) {
        try {
            let instanceUrl;
            try {
                instanceUrl = this.moduleHandler.getModuleUrlFromName(input);
            } catch (e) {}
            if (this.moduleHandler.getConnectedInstancesUrl().length !== 0) {
                for (let connectedInstance of this.moduleHandler.getConnectedInstancesUrl()) {
                    if (connectedInstance === input) {
                        instanceUrl = connectedInstance;
                    }
                }
            } 
            const app = await this.appHandler.getApp(instanceUrl);
            app.logout().then((res) => {
                this.fileHandler.deleteInstanceJSON(instanceUrl);
                this.appHandler.getAppList().delete(instanceUrl);
                this.moduleHandler.spreadToken(instanceUrl, null);
                this.barItem.show(this.fileHandler.fileList, this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
                window.showInformationMessage('Simplicite: ' + res.result + ' from: ' + app.parameters.url);
                logger.info(res.result + ' from: ' + app.parameters.url);
            }).catch(e => {
                if (e.status === 401 || e.code === 'ECONNREFUSED') {
                    window.showInformationMessage(`Simplicite: You are not connected to ${input}`);
                } else {
			        logger.error(e);
                    window.showErrorMessage(`${e}`);
                }
            });
        } catch (e) {
			logger.error(e);
            window.showErrorMessage(`${e}`);
        }
    }

    async applyChangesHandler () { // AJOUTER SETTINGS SKIP_LOCAL_COMPILATION
        return new Promise(async (resolve, reject) => {
            try {
                this.beforeApply(this.fileHandler.fileList);
                if (!workspace.getConfiguration('simplicite-vscode').get('disableCompilation')) {
                    await this.compileJava(
                        { 
                            message: 'Cannot apply changes with compilation errors (you can disable the compilation step in the settings).',
                            button: 'Settings'
                        });
                }  
                const fileModule = this.bindFileWithModule(this.fileHandler.fileList);
                let numberOfErrors = 0;
                for (let connectedModule of this.moduleHandler.getConnectedInstancesUrl()) {
                    const app = await this.appHandler.getApp(connectedModule);
                    if (!fileModule[connectedModule]) continue; 
                    for (let filePath of fileModule[connectedModule]) {
                        try {
                            await this.attachFileAndSend(filePath, app);
                            logger.info(filePath + ' successfully applied');
                        } catch (e) {
                            window.showErrorMessage(`Simplicite: Error sending ${filePath} \n ${e.message ? e.message : e}`);
                            logger.error(e);
                            numberOfErrors++;
                        }
                    }
                    await this.triggerBackendCompilation(app);
                }
                const fileListLength = this.fileHandler.fileList.length
                if (numberOfErrors === fileListLength) {
                    window.showInformationMessage('Simplicite: Cannot apply any change');
                } else {
                    window.showInformationMessage(`Simplicite: Changed ${fileListLength - numberOfErrors} files over ${fileListLength}`);
                    this.fileHandler.deleteModifiedFiles();
                    this.fileHandler.fileList = new Array();
                }
                resolve();
            } catch(e) {
                return reject(e);
            }
        });    
    }

    async triggerBackendCompilation (app) {
        try {
            let obj = app.getBusinessObject('Script', 'ide_Script');
            const res = await obj.action('CodeCompile', 0);
            window.showInformationMessage(`Simplicite: ${res}`); // differentiate error and info
            logger.info('compilation succeeded');
        } catch (e) {
			logger.error(e);
            window.showErrorMessage('Simplicite: Error cannnot trigger backend compilation');
        }
    }

    beforeApply (fileList) {
        if (this.moduleHandler.getConnectedInstancesUrl().length === 0) {
            throw 'Simplicite: No module connected';
        } else if (fileList.length === 0) {
            throw 'Simplicite: No file has changed';
        };
    }

    bindFileWithModule (fileList) {
        let flag = false;
        let fileModule = {};
        for (let {instanceUrl, filePath} of fileList) {
            if (this.moduleHandler.getConnectedInstancesUrl().includes(instanceUrl)) { 
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
                let fileType;
                let fileName;
                let properNameField;
                ({ fileType, fileName, properNameField } = this.operationsBeforeObjectManipulation(filePath));
                // get the item for the update
                let obj = app.getBusinessObject(fileType, 'ide_' + fileType);
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
                .then(() => {
                    resolve();
                }).catch((e) => {
			        logger.error(e);
                    throw e;
                })
            } catch (e) {
                return reject(e);
            }   
        })   
    }

    async getBusinessObjectFields (connectedInstance) {
        try {
            const app = this.appHandler.getApp(connectedInstance);
            const moduleName = this.moduleHandler.getModuleNameFromUrl(connectedInstance);
            await this.getDevInfo(app, moduleName);
            const objectExternal = this.moduleDevInfo.ObjectInternal;
            if (objectExternal.length === 0) throw 'No object fields has been found on the module ' + moduleName;
            return objectExternal;
        } catch (e) {
			logger.error(e);
        }
    }

    operationsBeforeObjectManipulation (filePath) {
        const fileType = this.getBusinessObjectType(filePath);
        let fileName = crossPlatformPath(filePath).split('/');
        fileName = fileName[fileName.length - 1].replaceAll('.java', '');
        const properNameField = this.getProperNameField(fileType);
        return { fileType, fileName, properNameField };
    }

    async searchForUpdate (fileName, obj, properNameField) {
        if (!this.cache.isInCache(fileName)) {
            let list = await obj.search({[properNameField]: fileName });
            if (list.length >= 2) console.log('More than one object has been returned with the name ' + fileName) ;
            if (list.length === 0) throw 'No object has been returned';
            this.cache.addPair(fileName, list[0].row_id);
        }
        let row_id = this.cache.getListFromCache(fileName);
        let item = await obj.getForUpdate(row_id, { inlineDocuments: true });
        return item;
    }
    
    getProperScriptField (fileType) {
        for (let object of this.devInfo.getObject()) {
            if (fileType === object.object) {
                return object.sourcefield;
            }
        }
    }

    getProperNameField (fileType) {
        for (let object of this.devInfo.getObject()) {
            if (fileType === object.object) return object.keyfield;
        }
    }

    // Change path into Java package modele to find object type with dev info
    getBusinessObjectType (fileName) { 
        let urlForPackageComparaison;
        fileName.includes('/') ? urlForPackageComparaison = fileName.replaceAll('/', '.') : urlForPackageComparaison = fileName.replaceAll('\\', '.'); 
        for (let object of this.devInfo.object) {
            if (urlForPackageComparaison.includes(object.package)) return object.object;
        }
        throw 'No type has been found';
    }
    
    async getDevInfo (app, moduleName) { // uses the first instance available to fetch the data
        try {
            if (app === undefined) {
                app = this.appHandler.getAppList()[0];
            }
            if (moduleName) {
                this.moduleDevInfo = await app.getDevInfo(moduleName);
            } else {
                this.devInfo = await app.getDevInfo();
            }    
        } catch(e) {
            logger.error(`get dev info: ` + e.message);
        }
    }

    connectedInstance () {
        if (this.moduleHandler.getConnectedInstancesUrl().length === 0) {
            window.showInformationMessage('Simplicite: No connected instance');     
        }
        for (let url of this.moduleHandler.getConnectedInstancesUrl()) {
            window.showInformationMessage('Simplicite: You are connected to: ' + url);     
        }
    }

    compileJava (customMessage) {
        // status can have the following values FAILED = 0, SUCCEED = 1, WITHERROR = 2, CANCELLED = 3
        return new Promise(async (resolve, reject) => {
            try {
                const status = await commands.executeCommand('java.workspace.compile', false) 
                switch (status) {
                    case 0:
                        window.showErrorMessage('Simplicite: Compilation failed');
                        reject();
                        break;
                    case 1:
                        window.showInformationMessage('Simplicite: Compilation succeeded');
                        resolve();
                        break;
                    case 3:
                        window.showErrorMessage('Simplicite: Compilation cancelled');
                        reject();
                        break;
                }
            } catch(e) {
                if (customMessage) {
                    window.showErrorMessage('Simplicite: An error occured during the compilation. ' + customMessage.message, customMessage.button).then(click => {
                        if (click === "Settings") {
                            openSettings();
                        }
                    });
                } else {
                    window.showErrorMessage('Simplicite: An error occured during the compilation.');
                    console.log(e);
                }
                reject(e);
            }
        })
    }

}

function openSettings () {
    try {
        commands.executeCommand('workbench.action.openSettings', '@ext:simpliciteextensiontest.simplicite-vscode');
    } catch(e) {
        console.log(e);
    }   
}

module.exports = {
    SimpliciteAPIManager: SimpliciteAPIManager,
}