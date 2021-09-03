'use strict';

class BarItem {
    constructor (vscode, name) {
        this.vscode = vscode;
        this.barItem = this.vscode.window.createStatusBarItem(2);
        this.barItem.text = name;
    }

    show (fileList, modules, moduleURLList) {
        this.barItem.tooltip = new this.vscode.MarkdownString(this.markdownGenerator(fileList, modules, moduleURLList));
        this.barItem.show();
    }
    
    markdownGenerator (fileList, modules, moduleURLList) {
        return this.fileListMarkdown(fileList) + '\n\n---\n\n' 
        + this.URLmodulesMarkdown(modules, moduleURLList) + '\n\n---\n\n' 
        + this.modulesMarkdown(modules, moduleURLList);
    }

    fileListMarkdown (fileList) {
        let fileMarkdown = 'Modified files:\n\n';
        if (fileList.length === 0) return fileMarkdown + '- none';
        for (let file of fileList) {
            fileMarkdown += '- ' + this.fileName(file.filePath)+ '\n\n';
        }
        return fileMarkdown;
    }

    URLmodulesMarkdown (modules, moduleURLList) {
        let moduleMarkdown = 'Connected Simplicite\'s instances and their corresponding modules:\n\n';
        if (moduleURLList.length === 0) return moduleMarkdown + '- none\n\n';
        for (let url of moduleURLList) {
            moduleMarkdown += url + ':\n';
            for (let module of modules) {
                if (url === module.moduleUrl) {
                    moduleMarkdown += '- ' + module.moduleInfo + '\n\n';
                }
            } 
        }
        return moduleMarkdown;
    } 

    modulesMarkdown (modules, moduleURLList) {
        if (modules.length === 0) return '';
        let moduleMarkdown = '';
        let firstTime = false;
        for (let module of modules) {
            if (!moduleURLList.includes(module.moduleUrl)) {
                if (!firstTime) {
                    moduleMarkdown += 'Disconnected modules:\n\n';
                    firstTime = true;
                } 
                moduleMarkdown += '- ' + module.moduleInfo + '\n\n';
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