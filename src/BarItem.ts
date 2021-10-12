'use strict';

import { window, MarkdownString, StatusBarItem } from 'vscode';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { File } from './File';
import { Module } from './Module';

export class BarItem {
    barItem: StatusBarItem;
    request: SimpliciteAPIManager | undefined;
    constructor (text: string, request: SimpliciteAPIManager) {
        this.barItem = window.createStatusBarItem(2);
        this.barItem.text = text;
        this.barItem.command = 'simplicite-vscode-tools.showSimpliciteCommands';
        this.request = request;
    }

    show (fileList: Array<File>, modules: Array<Module>, connectedInstancesUrl: Array<string>) {
        this.barItem.tooltip = new MarkdownString(this.markdownGenerator(fileList, modules, connectedInstancesUrl));
        this.barItem.show();
    }
    
    markdownGenerator (fileList: Array<File>, modules: Array<Module>, connectedInstancesUrl: Array<string>) {
        return this.urlModulesMarkdown(modules, connectedInstancesUrl) + '\n\n---\n\n' 
        + this.modulesMarkdown(modules, connectedInstancesUrl);
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