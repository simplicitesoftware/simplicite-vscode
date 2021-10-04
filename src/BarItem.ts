'use strict';

import { window, MarkdownString, commands, extensions, StatusBarItem, ExtensionContext, Command } from 'vscode';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { File } from './File';
import { Module } from './Module';

export class BarItem {
    barItem: StatusBarItem;
    request: SimpliciteAPIManager | undefined;
    constructor (text: string) {
        this.barItem = window.createStatusBarItem(2);
        this.barItem.text = text;
        this.request = undefined;
    }
    
    static async build(text: string, request: SimpliciteAPIManager) {
        const barItem = new BarItem(text);
        await barItem.init(request);
        return barItem;
    }

    private async init (request: SimpliciteAPIManager) {
        this.request = request;
        this.barItem.command = 'simplicite-vscode.showSimpliciteCommands';
    }

    show (fileList: Array<File>, modules: Array<Module>, connectedInstancesUrl: Array<string>) {
        this.barItem.tooltip = new MarkdownString(this.markdownGenerator(fileList, modules, connectedInstancesUrl));
        this.barItem.show();
    }
    
    markdownGenerator (fileList: Array<File>, modules: Array<Module>, connectedInstancesUrl: Array<string>) {
        return this.fileListMarkdown(fileList) + '\n\n---\n\n' 
        + this.urlModulesMarkdown(modules, connectedInstancesUrl) + '\n\n---\n\n' 
        + this.modulesMarkdown(modules, connectedInstancesUrl);
    }

    fileListMarkdown (fileList: Array<File>) {
        let fileMarkdown = 'Modified files:\n\n';
        if (fileList.length === 0) {
            return fileMarkdown + '- none';
        }
        for (let file of fileList) {
            fileMarkdown += '- ' + this.fileName(file.filePath)+ '\n\n';
        }
        return fileMarkdown;
    }

    urlModulesMarkdown (modules: Array<Module>, connectedInstancesUrl: Array<string>) {
        let moduleMarkdown = 'Connected Simplicite\'s instances and their corresponding modules:\n\n';
        if (connectedInstancesUrl.length === 0) {
            return moduleMarkdown + '- none\n\n';
        }
        for (let url of connectedInstancesUrl) {
            moduleMarkdown += url + ':\n';
            for (let module of modules) {
                if (url === module.getInstanceUrl()) {
                    moduleMarkdown += '- ' + module.getName() + '\n\n';
                }
            } 
        }
        return moduleMarkdown;
    } 

    modulesMarkdown (modules: Array<Module>, connectedInstancesUrl: Array<string>) {
        if (modules.length === 0) {
            return '';
        }
        let moduleMarkdown = '';
        let firstTime = false;
        for (let module of modules) {
            if (!connectedInstancesUrl.includes(module.getInstanceUrl())) {
                if (!firstTime) {
                    moduleMarkdown += 'Disconnected modules:\n\n';
                    firstTime = true;
                } 
                moduleMarkdown += '- ' + module.getName() + '\n\n';
            } 
        }

        return moduleMarkdown;
    }

    fileName (filePath: string) {
        const fileList = filePath.split('/');
        if (fileList[fileList.length - 1].includes('.java')) {
            return fileList[fileList.length - 1];
        }
    }

    

}