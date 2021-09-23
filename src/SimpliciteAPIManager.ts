'use strict';

import { Module } from './Module';
import { window, commands, workspace } from 'vscode';
import { Cache } from './Cache';
import { FileHandler } from './FileHandler';
import { crossPlatformPath } from './utils';
import { AppHandler } from './AppHandler';
import { ModuleHandler } from './ModuleHandler';
import { logger } from './Log';
import { File } from './File';
import { replaceAll } from './utils';
import { BarItem } from './BarItem';
import { FieldObjectTree } from './FieldObjectTree';

interface CustomMessage {
    message: string;
    button: string;
}

interface ReturnValueOperationsBeforeObjectManipulation {
    fileType: string;
    fileName: string;
    properNameField: string;
}

export class SimpliciteAPIManager {
    cache: Cache;
    devInfo: any;
    moduleDevInfo: any;
    appHandler: AppHandler;
    fileHandler: FileHandler;
    moduleHandler: ModuleHandler;
    barItem?: BarItem;
    constructor () {
        this.cache = new Cache();
        this.devInfo = null; // needs to be logged in, fetch on first login (provides services only when connected)
        this.moduleDevInfo = null; // fetched in getDevInfo when module is defined
        this.appHandler = new AppHandler();
        this.fileHandler = new FileHandler();
        this.moduleHandler = new ModuleHandler();
        this.barItem = undefined;
    }

    async init () {
        await this.moduleHandler.setModules(await this.fileHandler.getSimpliciteModules());
        this.fileHandler.getModifiedFilesOnStart();
        if (this.moduleHandler.moduleLength() !== 0 && this.fileHandler.fileListLength() !== 0) {
            logger.info('Modules and files set on initialization');
        }
        if (this.moduleHandler.moduleLength() === 0) {
            logger.warn('No modules set on initialization');
        }
        if (this.fileHandler.fileListLength()) {
            logger.warn('No files set on initialization');
        }
    }

    static async build () {
        const simpliciteAPIManager = new SimpliciteAPIManager();
        await simpliciteAPIManager.init();
        return simpliciteAPIManager;
    }

    async loginHandler () {
        if (this.moduleHandler.moduleLength() > 0) {
            for (let module of this.moduleHandler.getModules()) {
                try { 
                    await this.loginTokenOrCredentials(module);
                } catch (e: any) {
                    window.showErrorMessage(e.message ? e.message : e);
                    logger.error(`Module ${module.getName()}: ${e.message ? e.message : e}`);
                }
            }
        } else {
            window.showInformationMessage('Simplicite: No Simplicite module has been found');
        }
    }

    async loginTokenOrCredentials (module: Module) {
        const app = await this.appHandler.getApp(module.getInstanceUrl()); // handleApp returns the app correct instance (one for every simplicite instance)
        try {
            await this.authenticationWithToken(module.getName(), app);
            await this.login(module.getInstanceUrl(), app);
            logger.info('Token connection succeeded');
        } catch (e) {
            try {
                await this.authenticationWithCredentials(module.getName(), app);
                await this.login(module.getInstanceUrl(), app);
                logger.info('Credentials connection succeeded');
            } catch (e) {
                throw e;
            }
        }
    }

    async login (moduleInstanceUrl: string, app: any) {
        try {
            const res = await app.login();
            if (!this.devInfo) {
                await this.getDevInfo(app);
            }
            await this.fileHandler.simpliciteInfoGenerator(res.authtoken, app.parameters.url); // if logged in we write a JSON with connected modules objects;
            this.moduleHandler.spreadToken(moduleInstanceUrl, res.authtoken);
            this.appHandler.setApp(moduleInstanceUrl, app);
            window.showInformationMessage('Simplicite: Logged in as ' + res.login + ' at: ' + app.parameters.url);
            logger.info('Logged in as ' + res.login + ' at: ' + app.parameters.url);
            this.barItem!.show(this.fileHandler.getFileList(), this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
        } catch (e) {
            app.setAuthToken(null);
            app.setPassword(null);
            app.setUsername(null);
            throw e;
        }                        
    }

    authenticationWithToken (moduleName: string, app: any) { // check if a token is available in process.env.APPDATA + /Code/User/globalStorage/simplicite-info.json  
        try {
            const moduleArray = this.fileHandler.getSimpliciteInfoContent();
            if (moduleArray === null) {
                throw new Error('No module has been found, cannot get token value');
            }
            for (let module of moduleArray) {
                if (module.getName() === moduleName && module.getToken()) {
                    app.setAuthToken(module.getToken());
                }
            }
        } catch(e) {
            console.log(e);
            throw e;
        }     
    }

    async authenticationWithCredentials (moduleName: string, app: any) {
        try {
            const username = await window.showInputBox({ 
                placeHolder: 'username',
                title: 'Simplicite: Authenticate to ' + moduleName + ' API (' + app.parameters.url +')'
            });
            if (!username) {
                throw new Error('Authentication cancelled');
            }
            const password = await window.showInputBox({
                placeHolder: 'password',
                title: 'Simplicite: Authenticate to ' + moduleName + ' API (' + app.parameters.url +')',
                password: true
            });
            if (!password) {
                throw new Error('Authentication cancelled');
            }
            app.setPassword(password);
            app.setUsername(username);
        } catch (e) {
            throw e;
        }
    }

    logout () {
        this.fileHandler.deleteSimpliciteInfo();
        this.appHandler.getAppList().forEach((app: any) => {
            app.logout().then((res: any) => {
                this.appHandler.setAppList(new Map());
                this.moduleHandler.spreadToken(app.parameters.url, null);
                window.showInformationMessage('Simplicite: ' + res.result + ' from: ' + app.parameters.url);
                logger.info(res.result + ' from: ' + app.parameters.url);
                this.barItem!.show(this.fileHandler.getFileList(), this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
            }).catch((e: any) => {
    			logger.error(e);
                window.showErrorMessage(e.message ? e.message : e);        
            });
        });
        if (this.appHandler.getAppList().size === 0) {
            window.showInformationMessage('Simplicite: You are not connected to any module');
        }
    }
    
    async specificLogout(input: string, fieldObjectTreeRefresh: () => Promise<void>, treeContext: FieldObjectTree) {
        try {
            let instanceUrl: string;
            instanceUrl = this.moduleHandler.getModuleUrlFromName(input);
            if (this.moduleHandler.getConnectedInstancesUrl().length !== 0) {
                for (let connectedInstance of this.moduleHandler.getConnectedInstancesUrl()) {
                    if (connectedInstance === input) {
                        instanceUrl = connectedInstance;
                    }
                }
            } 
            const app = await this.appHandler.getApp(instanceUrl);
            app.logout().then(async (res: any) => {
                this.fileHandler.deleteInstanceJSON(instanceUrl);
                this.appHandler.getAppList().delete(instanceUrl);
                this.moduleHandler.spreadToken(instanceUrl, null);
                this.barItem!.show(this.fileHandler.getFileList(), this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
                window.showInformationMessage('Simplicite: ' + res.result + ' from: ' + app.parameters.url);
                logger.info(res.result + ' from: ' + app.parameters.url);
                this.barItem!.show(this.fileHandler.getFileList(), this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
                await fieldObjectTreeRefresh.call(treeContext);

            }).catch((e: any) => {
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
        this.barItem!.show(this.fileHandler.getFileList(), this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
    }

    async applyChangesHandler () {
        try {
            this.beforeApply(this.fileHandler.getFileList());
            if (!workspace.getConfiguration('simplicite-vscode').get('disableCompilation')) {
                await this.compileJava(
                    { 
                        message: 'Cannot apply changes with compilation errors (you can disable the compilation step in the settings).',
                        button: 'Settings'
                    });
            }  
            const fileModule = this.bindFileWithModule(this.fileHandler.getFileList());
            let numberOfErrors = 0;
            for (let connectedModule of this.moduleHandler.getConnectedInstancesUrl()) {
                const app = await this.appHandler.getApp(connectedModule);
                if (fileModule.get(connectedModule)) {
                    for (let filePath of fileModule.get(connectedModule) || []) {
                        try {
                            await this.attachFileAndSend(filePath, app);
		                    this.barItem!.show(this.fileHandler.getFileList(), this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
                            logger.info('Successfully applied' + filePath);
                        } catch (e: any) {
                            window.showErrorMessage(`Simplicite: Error sending ${filePath} \n ${e.message ? e.message : e}`);
                            logger.error(e);
                            numberOfErrors++;
                        }
                    }
                    await this.triggerBackendCompilation(app);
                } else {
                    continue;
                }
            }
            const fileListLength = this.fileHandler.fileListLength();
            if (numberOfErrors === fileListLength) {
                window.showInformationMessage('Simplicite: Cannot apply any change');
            } else {
                window.showInformationMessage(`Simplicite: Changed ${fileListLength - numberOfErrors} files over ${fileListLength}`);
                this.fileHandler.deleteModifiedFiles();
                this.fileHandler.resetFileList();
            }
            this.barItem!.show(this.fileHandler.getFileList(), this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
            return;
        } catch(e) {
            throw e;
        }  
    }

    async triggerBackendCompilation (app: any) {
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

    beforeApply (fileList: Array<File>) {
        if (this.moduleHandler.getConnectedInstancesUrl().length === 0) {
            throw new Error('Simplicite: No module connected, cannot apply changes');
        } else if (fileList.length === 0) {
            throw new Error('Simplicite: No file has changed, cannot apply changes');
        };
    }

    bindFileWithModule (fileList: Array<File>): Map<string, Array<string>> {
        let flag = false;
        let fileModule: Map<string, Array<string>>;
        fileModule = new Map();
        for (let {instanceUrl, filePath} of fileList) {
            if (this.moduleHandler.getConnectedInstancesUrl().includes(instanceUrl)) {
                fileModule.get(instanceUrl) ? fileModule.get(instanceUrl)?.push(filePath) : fileModule.set(instanceUrl, [filePath]);                 
                flag = true;
            }
        }
        if (!flag) {
            throw new Error('Simplicite: Module not connected, check the connected instances');
        } 
        return fileModule;
    }

    // Called by synchronize
    async attachFileAndSend (filePath: string, app: any) {
        try { 
            // get fileType and Filename
            let fileType: string;
            let fileName: string;
            let properNameField: string;
            ({ fileType, fileName, properNameField } = this.operationsBeforeObjectManipulation(filePath));
            // get the item for the update
            let obj = app.getBusinessObject(fileType, 'ide_' + fileType);
            let item = await this.searchForUpdate(fileName, obj, properNameField); 
            // give the field, ex: obo_script_id, scr_file
            const fieldScriptId = this.getProperScriptField(fileType);       
            let doc = obj.getFieldDocument(fieldScriptId);

            // get the file content for setContent
            const fileContent = await this.fileHandler.findFiles('**/' + fileName + '.java');
            if (fileContent.length >= 2) {
                throw new Error('Simplicite: Module not connected, check the connected instances');
            }
            doc.setContentFromText(fileContent[0]);
            obj.setFieldValue(fieldScriptId, doc);
            obj.update(item, { inlineDocuments: true})
            .then(() => {
                Promise.resolve();
            }).catch((e: Error) => {
                logger.error(e);
                throw e;
            });
        } catch (e) {
            Promise.reject(e);
        }     
    }

    async getBusinessObjectFields (connectedInstance: string, moduleName: string) {
        const app = this.appHandler.getApp(connectedInstance);
        if (app.authtoken === undefined) {
            throw new Error(`Cannot get object fields, not connected to ${moduleName} (${connectedInstance})`);
        }
        await this.getDevInfo(app, moduleName);
        const objectExternal = this.moduleDevInfo.ObjectInternal;
        if (objectExternal.length === 0) {
            throw new Error('No object fields has been found on the module ' + moduleName);
        } 
        return objectExternal;
    }

    

    operationsBeforeObjectManipulation (filePath: string): ReturnValueOperationsBeforeObjectManipulation {
        const fileType = this.getBusinessObjectType(filePath);
        let filePathDecomposed = crossPlatformPath(filePath).split('/');
        let fileName = replaceAll(filePathDecomposed[filePathDecomposed.length - 1], '.java', '');
        const properNameField = this.getProperNameField(fileType);
        return { fileType, fileName, properNameField };
    }

    async searchForUpdate (fileName: string, obj: any, properNameField: string) {
        if (!this.cache.isInCache(fileName)) {
            let list = await obj.search({[properNameField]: fileName });
            if (list.length >= 2) {
                logger.error('More than one object has been returned with the name ' + fileName) ;
            }
            if (list.length === 0) {
                throw new Error('No object has been returned');
            }
            this.cache.addPair(fileName, list[0].row_id);
        }
        let rowId = this.cache.getListFromCache(fileName);
        let item = await obj.getForUpdate(rowId, { inlineDocuments: true });
        return item;
    }
    
    getProperScriptField (fileType: string) {
        for (let object of this.devInfo.getObject()) {
            if (fileType === object.object) {
                return object.sourcefield;
            }
        }
    }

    getProperNameField (fileType: string) {
        for (let object of this.devInfo.getObject()) {
            if (fileType === object.object) {
                return object.keyfield;
            }
        }
    }

    // Change path into Java package modele to find object type with dev info
    getBusinessObjectType (fileName: string) { 
        let urlForPackageComparaison;
        fileName.includes('/') ? urlForPackageComparaison = replaceAll(fileName, '/\\/', '.') : urlForPackageComparaison = replaceAll(fileName, '/\\/', '.'); 
        for (let object of this.devInfo.object) {
            if (urlForPackageComparaison.includes(object.package)) {
                return object.object;
            } 
        }
        throw new Error('No type has been found');
    }
    
    async getDevInfo (app: any, moduleName?: string) { // uses the first instance available to fetch the data
        try {
            //if (app === undefined) {
            //    app = this.appHandler.getAppList()[0];
            //}
            if (moduleName) {
                this.moduleDevInfo = await app.getDevInfo(moduleName);
            } else {
                this.devInfo = await app.getDevInfo();
            }    
        } catch(e: any) {
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

    

    async compileJava (customMessage?: CustomMessage) {
        // status can have the following values FAILED = 0, SUCCEED = 1, WITHERROR = 2, CANCELLED = 3
        try {
            const status = await commands.executeCommand('java.workspace.compile', false);
            switch (status) {
                case 0:
                    window.showErrorMessage('Simplicite: Compilation failed');
                    return 'Compilation failed';
                case 1:
                    window.showInformationMessage('Simplicite: Compilation succeeded');
                    return 'Compilation succeeded';
                case 3:
                    window.showErrorMessage('Simplicite: Compilation cancelled');
                    return 'Compilation cancelled';
            }
        } catch(e: any) {
            if (customMessage) { // occurs when compileJava is called from applyChangedHandler
                window.showErrorMessage('Simplicite: An error occured during the compilation. ' + customMessage.message, customMessage.button).then(click => {
                    if (click === "Settings") {
                        openSettings();
                    }
                });
                logger.error('Cannot Apply changers: an error occured during the compilation. Check if there is no error in the java files of your module(s)');
                throw new Error('');
            } else {
                window.showErrorMessage('Simplicite: An error occured during the compilation.');
                throw new Error((e.message ? e.message : e) + ' Check if there is error(s) in the java files of your module(s)');
            }
        }
    }

    setBarItem (barItem: BarItem) {
        this.barItem = barItem;
    }

}

function openSettings () {
    try {
        commands.executeCommand('workbench.action.openSettings', '@ext:simpliciteextensiontest.simplicite-vscode');
    } catch (e) {
        logger.error(e);
    }   
}