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
import { ObjectInfoTree } from './treeView/ObjectInfoTree';
import { FileTree } from './treeView/FileTree';
import { ReturnValueOperationsBeforeObjectManipulation, CustomMessage } from './interfaces';

export class SimpliciteAPIManager {
    cache: Cache;
    devInfo: any;
    moduleDevInfo: any;
    appHandler: AppHandler;
    fileHandler: FileHandler;
    moduleHandler: ModuleHandler;
    barItem?: BarItem;
    constructor (fileTree: FileTree) {
        this.cache = new Cache();
        this.devInfo = null; // needs to be logged in, fetch on first login (provides services only when connected)
        this.moduleDevInfo = null; // fetched in getDevInfo when module is defined
        this.appHandler = new AppHandler();
        this.fileHandler = new FileHandler(fileTree);
        this.moduleHandler = new ModuleHandler();
        this.barItem = undefined;
    }

    async init () {
        await this.moduleHandler.setModules(await this.fileHandler.getSimpliciteModules());
        await this.fileHandler.getModifiedFilesOnStart(this.moduleHandler.getModules());
        if (this.moduleHandler.moduleLength() !== 0 && this.fileHandler.fileListLength() !== 0) {
            logger.info('Modules and files set on initialization');
        }
        if (this.moduleHandler.moduleLength() === 0) {
            logger.warn('No modules set on initialization');
        }
        if (this.fileHandler.fileListLength() === 0) {
            logger.warn('No files set on initialization');
        }
    }

    static async build (fileTree: FileTree) {
        const simpliciteAPIManager = new SimpliciteAPIManager(fileTree);
        await simpliciteAPIManager.init();
        return simpliciteAPIManager;
    }

    async loginHandler () {
        if (this.moduleHandler.moduleLength() > 0) {
            let activateTreeViewUpdate = true;
            for (let module of this.moduleHandler.getModules()) {
                if (!this.moduleHandler.getConnectedInstancesUrl().includes(module.getInstanceUrl())) {
                    try { 
                        await this.loginTokenOrCredentials(module, activateTreeViewUpdate);
                        activateTreeViewUpdate = false;
                    } catch (e: any) {
                        window.showErrorMessage(e.message ? e.message : e);
                        logger.error(`Module ${module.getName()}: ${e.message ? e.message : e}`);
                    }
                }
            }
        } else {
            window.showInformationMessage('Simplicite: No Simplicite module has been found');
        }
    }

    async loginTokenOrCredentials (module: Module, activateTreeViewUpdate: boolean) {
        const app = await this.appHandler.getApp(module.getInstanceUrl()); // handleApp returns the app correct instance (one for every simplicite instance)
        try {
            await this.authenticationWithToken(module.getName(), app);
            await this.login(module.getInstanceUrl(), app, activateTreeViewUpdate);
            logger.info('Token connection succeeded');
        } catch (e) {
            try {
                await this.authenticationWithCredentials(module.getName(), app);
                await this.login(module.getInstanceUrl(), app, activateTreeViewUpdate);
                logger.info('Credentials connection succeeded');
            } catch (e) {
                throw e;
            }
        }
    }

    async login (moduleInstanceUrl: string, app: any, activateTreeViewUpdate: boolean) {
        try {
            const res = await app.login();
            if (!this.devInfo) {
                await this.setDevInfo(app);
            }
            await this.fileHandler.simpliciteInfoGenerator(res.authtoken, app.parameters.url); // if logged in we write a JSON with connected modules objects;
            this.moduleHandler.spreadToken(moduleInstanceUrl, res.authtoken);
            this.appHandler.setApp(moduleInstanceUrl, app);
            this.moduleHandler.addInstanceUrl(moduleInstanceUrl);
            window.showInformationMessage('Simplicite: Logged in as ' + res.login + ' at: ' + app.parameters.url);
            logger.info('Logged in as ' + res.login + ' at: ' + app.parameters.url);
            if (activateTreeViewUpdate) {
            commands.executeCommand('simplicite-vscode.refreshTreeView');
            }
            this.barItem!.show(this.fileHandler.getFileList(), this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
        } catch (e) {
            app.setAuthToken(null);
            app.setPassword(null);
            app.setUsername(null);
            logger.error(e);
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
                this.moduleHandler.removeInstanceUrl(app.parameters.url);
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
    
    async specificLogout(input: string, fieldObjectTreeRefresh: () => Promise<void>, treeContext: ObjectInfoTree) {
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
                this.moduleHandler.removeConnectedInstancesUrl(instanceUrl);
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

    async applyChangesHandler (moduleName: string | undefined, instanceUrl: string | undefined) {
        try {
            await this.beforeApply(this.fileHandler.getFileList());
            if (moduleName && instanceUrl) {
                if (!checkFileModuleSpecific(moduleName, this.fileHandler.getFileList())) {
                    throw new Error('Simplicite: No file has changed, cannot apply changes');
                }
                await this.applyModuleFiles(moduleName, instanceUrl);
            } else {
                await this.applyInstanceFiles();
            }
            this.barItem!.show(this.fileHandler.getFileList(), this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
            return;
        } catch(e) {
            throw e;
        }  
    }

    async applyModuleFiles (moduleName: string, instanceUrl: string) {
        const app = await this.appHandler.getApp(instanceUrl);
        let error = 0;
        let cptFile = 0;
        const toDelete = new Array();
        for (let file of this.fileHandler.getFileList()) {
            if (file.moduleName === moduleName && file.tracked) {
                cptFile++;
                try {
                    await this.sendFile(file, app);
                    toDelete.push(file);
                } catch (e) {
                    error++;
                    logger.error('Cannot apply ' + file.getFilePath());
                }
            }
        }
        for (let file of toDelete) {
            this.fileHandler.deleteFileFromListAndDisk(file.getFilePath(), this.moduleHandler.getModules());
        }
        try {
            const res: any = await this.triggerBackendCompilation(app); 
            window.showInformationMessage(res);
        } catch (e: any) {
            window.showInformationMessage(e.message);
        }
        if (error > 0) {
            window.showWarningMessage(`Simplicite: could not send ${error} out of ${cptFile} files`);
        }
    }

    async applyInstanceFiles () {
        const fileModule = this.bindFileWithModule(this.fileHandler.getFileList());
        let errors = 0;
        for (let instanceUrl of this.moduleHandler.getConnectedInstancesUrl()) {
            const toDelete = new Array();
            const app = await this.appHandler.getApp(instanceUrl);
            if (fileModule.get(instanceUrl)) {
                for (let file of fileModule.get(instanceUrl)!) {
                    await this.sendFile(file, app);
                    toDelete.push(file);
                }
            for (let file of toDelete) {
                this.fileHandler.deleteFileFromListAndDisk(file.getFilePath(), this.moduleHandler.getModules());
            }
            } else {
                continue;
            }
            try {
                await this.triggerBackendCompilation(app);
                logger.info('Backend compilation succeded');
            } catch(e: any) {
                window.showErrorMessage(e.message);
                logger.error(e.message);
            }
        }
    }

    async sendFile (file: File, app: any) {
        try {
            await this.attachFileAndSend(file.filePath, app);
            this.barItem!.show(this.fileHandler.getFileList(), this.moduleHandler.getModules(), this.moduleHandler.getConnectedInstancesUrl());
            logger.info('Successfully applied' + file.filePath);
        } catch (e: any) {
            window.showErrorMessage(`Simplicite: Error sending ${file.filePath} \n ${e.message ? e.message : e}`);
            logger.error(e);
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

    async beforeApply (fileList: Array<File>) {
        if (this.moduleHandler.getConnectedInstancesUrl().length === 0) {
            throw new Error('Simplicite: No module connected, cannot apply changes');
        } else if (fileList.length === 0) {
            throw new Error('Simplicite: No file has changed, cannot apply changes');
        };
        if (!workspace.getConfiguration('simplicite-vscode').get('disableCompilation')) {
            const res = await this.compileJava(
            { 
                message: 'Cannot apply changes with compilation errors (you can disable the compilation step in the settings).',
                button: 'Settings'
            });
            if (res !== 'Compilation succeeded') {
                throw new Error('');
            }
        }  
    }

    bindFileWithModule (fileList: Array<File>): Map<string, Array<File>> {
        let flag = false;
        let fileModule: Map<string,Array<File>>;
        fileModule = new Map();
        for (let file of fileList) {
            if (this.moduleHandler.getConnectedInstancesUrl().includes(file.getInstanceUrl())) {
                fileModule.get(file.getInstanceUrl()) ? fileModule.get(file.getInstanceUrl())?.push(file) : fileModule.set(file.getInstanceUrl(), [file]);                 
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

    async getmoduleDevInfo (connectedInstance: string, moduleName: string) {
        const app = this.appHandler.getApp(connectedInstance);
        if (app.authtoken === undefined) {
            throw new Error(`Cannot get object fields, not connected to ${moduleName} (${connectedInstance})`);
        }
        await this.setDevInfo(app, moduleName);
        if (this.moduleDevInfo.length === 0) {
            throw new Error('moduleDevInfo is empty ' + moduleName);
        }
        return this.moduleDevInfo;
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
        for (let object of this.devInfo.objects) {
            if (fileType === object.object) {
                return object.sourcefield;
            }
        }
    }

    getProperNameField (fileType: string) {
        for (let object of this.devInfo.objects) {
            if (fileType === object.object) {
                return object.keyfield;
            }
        }
    }

    // Change path into Java package modele to find object type with dev info
    getBusinessObjectType (fileName: string) { 
        for (let object of this.devInfo.objects) {
            const comparePackage = object.package.replaceAll('.', '/');
            if (fileName.includes(comparePackage)) {
                return object.object;
            } 
        }
        throw new Error('No type has been found');
    }
    
    async setDevInfo (app: any, moduleName?: string) { // uses the first instance available to fetch the data
        try {
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

function checkFileModuleSpecific (moduleName: string, files: File[]) {
    for(let file of files) {
        if (file.moduleName === moduleName) {
            return true;
        }
    }
    return false;
}