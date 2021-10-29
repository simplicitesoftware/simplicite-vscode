'use strict';

import { window, MarkdownString, StatusBarItem, env } from 'vscode';
import { Module } from './Module';
import { validFileExtension } from './utils';

export class BarItem {
    barItem: StatusBarItem;
    constructor (text: string) {
        this.barItem = window.createStatusBarItem(2);
        this.barItem.text = text;
        this.barItem.command = 'simplicite-vscode-tools.showSimpliciteCommands'; // opens quick pick
    }

    // refreshs the BarItem
    show (modules: Array<Module>, connectedInstancesUrl: Array<string>): void {
        if (modules.length === 0 && connectedInstancesUrl.length === 0) {
            this.barItem.tooltip = 'No Simplicite module detected';
            return;
        }
        if (env.appHost !== 'desktop') {
            if (connectedInstancesUrl.length === 0) {
                this.barItem.tooltip = 'No module connected';
            } else {
                this.barItem.tooltip = 'Connected modules: ';
                let cpt = 0;
                for (let instance of connectedInstancesUrl) {
                    this.barItem.tooltip += instance;
                    if (cpt !== connectedInstancesUrl.length - 1) {
                        this.barItem.tooltip += ', ';
                        cpt++;
                    }
                }  
            }  
        } else {
            this.barItem.tooltip = new MarkdownString(this.markdownGenerator(modules, connectedInstancesUrl));
        }
        this.barItem.show();    
    }
    
    private markdownGenerator (modules: Array<Module>, connectedInstancesUrl: Array<string>) {
        
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
                    if (url === module.instanceUrl) {
                        moduleMarkdown += '- ' + module.name + '\n\n';
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
                if (!connectedInstancesUrl.includes(module.instanceUrl)) {
                    moduleMarkdown += '- ' + module.name + '\n\n';
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
        if (validFileExtension(fileList[fileList.length - 1])) {
            return fileList[fileList.length - 1];
        }
    }
}