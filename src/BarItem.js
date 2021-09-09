'use strict';

const { window, MarkdownString, commands, extensions } = require('vscode');
const { extensionId } = require('./constant');

class BarItem {
    constructor (name) {
        this.barItem = window.createStatusBarItem(2);
        this.barItem.text = name;
    }

    async init (context) {
        const commandId = 'simplicite-vscode.showSimpliciteCommands';
        context.subscriptions.push(commands.registerCommand(commandId, async () => await this.quickPickEntry()));
        this.barItem.command = commandId;
    }

    async quickPickEntry () { // entry point called by command
        const simpliciteExtension = extensions.getExtension(extensionId);
        const commandList = simpliciteExtension.packageJSON.contributes.commands;
        const commandQuickPick = this.commandListQuickPick(commandList);
        const target = await window.showQuickPick(commandQuickPick);
        if (target) {
            try {
                await commands.executeCommand(target.commandId);
            } catch (e) {
                console.log(e.message ? e.message : 'Error occured while executing command');
            }
        }
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

    commandListQuickPick (commandList) {
        const preparedList = new Array();
        for (let command of commandList) {
            preparedList.push({ label: command.title, commandId: command.command });
        }
        return preparedList;
    }

}

module.exports = {
    BarItem: BarItem
}