'use strict';

import { window, MarkdownString, StatusBarItem } from 'vscode';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { Module } from './Module';

export class BarItem {
    barItem: StatusBarItem;
    request: SimpliciteAPIManager | undefined;
    constructor (text: string, request: SimpliciteAPIManager) {
        this.barItem = window.createStatusBarItem(2);
        this.barItem.text = text;
        this.barItem.command = 'simplicite-vscode-tools.showSimpliciteCommands'; // opens quick pick
        this.request = request;
    }

    // refreshs the BarItem
    show (modules: Array<Module>, connectedInstancesUrl: Array<string>): void {
        this.barItem.tooltip = new MarkdownString(this.markdownGenerator(modules, connectedInstancesUrl));
        this.barItem.show();
    }
    
    private markdownGenerator (modules: Array<Module>, connectedInstancesUrl: Array<string>) {
        if (modules.length === 0 && connectedInstancesUrl.length === 0) {
            return 'No Simplicite module detected';
        }
        return this.connectedInstancesAndModules(modules, connectedInstancesUrl) + this.disconnectedInstancesAndModules(modules, connectedInstancesUrl);
    }

    // creates the markdown of the connected instances and their modules
    private connectedInstancesAndModules (modules: Array<Module>, connectedInstancesUrl: Array<string>): string {
        let moduleMarkdown = '';
        if (connectedInstancesUrl.length > 0) {
            moduleMarkdown = 'Connected Simplicite\'s instances:\n\n';
            for (let url of connectedInstancesUrl) {
                moduleMarkdown += url + ':\n';
                for (let module of modules) {
                    if (url === module.getInstanceUrl()) {
                        moduleMarkdown += '- ' + module.getName() + '\n\n';
                    }
                } 
            }
            moduleMarkdown += '\n\n---\n\n';
        }
        return moduleMarkdown;
    } 

    // creates the markdown of the connected instances and their modules
    private disconnectedInstancesAndModules (modules: Array<Module>, connectedInstancesUrl: Array<string>): string {
        let moduleMarkdown = '';
        let disconnectedModule = false;        
        if (modules.length > 0) {
            moduleMarkdown += 'Disconnected modules:\n\n';
            for (let module of modules) {
                if (!connectedInstancesUrl.includes(module.getInstanceUrl())) {
                    moduleMarkdown += '- ' + module.getName() + '\n\n';
                    disconnectedModule = true;
                } 
            }
            if (!disconnectedModule) {
                return '';
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