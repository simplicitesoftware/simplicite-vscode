'use strict';

const { window, MarkdownString,} = require('vscode');

class BarItem {
    constructor (name) {
        this.barItem = window.createStatusBarItem(2);
        this.barItem.text = name;
    }

    show (fileList, modules, connectedInstancesUrl) {
        this.barItem.tooltip = new MarkdownString(this.markdownGenerator(fileList, modules, connectedInstancesUrl));
        this.barItem.show();
    }
    
    markdownGenerator (fileList, modules, connectedInstancesUrl) {
        return this.fileListMarkdown(fileList) + '\n\n---\n\n' 
        + this.URLmodulesMarkdown(modules, connectedInstancesUrl) + '\n\n---\n\n' 
        + this.modulesMarkdown(modules, connectedInstancesUrl);
    }

    fileListMarkdown (fileList) {
        let fileMarkdown = 'Modified files:\n\n';
        if (fileList.length === 0) return fileMarkdown + '- none';
        for (let file of fileList) {
            fileMarkdown += '- ' + this.fileName(file.filePath)+ '\n\n';
        }
        return fileMarkdown;
    }

    URLmodulesMarkdown (modules, connectedInstancesUrl) {
        let moduleMarkdown = 'Connected Simplicite\'s instances and their corresponding modules:\n\n';
        if (connectedInstancesUrl.length === 0) return moduleMarkdown + '- none\n\n';
        for (let url of connectedInstancesUrl) {
            moduleMarkdown += url + ':\n';
            for (let module of modules) {
                if (url === module.moduleUrl) {
                    moduleMarkdown += '- ' + module.moduleInfo + '\n\n';
                }
            } 
        }
        return moduleMarkdown;
    } 

    modulesMarkdown (modules, connectedInstancesUrl) {
        if (modules.length === 0) return '';
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

    fileName (filePath) {
        const fileList = filePath.split('/');
        if (fileList[fileList.length - 1].includes('.java') !== -1) return fileList[fileList.length - 1]
    }

}

module.exports = {
    BarItem: BarItem
}