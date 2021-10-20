'use strict';

import { ExtensionContext, commands, Command, extensions, window } from 'vscode';
import { EXTENSION_ID } from './constant';
import { logger } from './Log';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';

export class QuickPick {
    request: SimpliciteAPIManager;
    constructor (context: ExtensionContext, request: SimpliciteAPIManager) {
        this.request = request;
        const commandId = 'simplicite-vscode-tools.showSimpliciteCommands';
        context.subscriptions.push(commands.registerCommand(commandId, async () => await this.quickPickEntry()));
    }

    commandListQuickPick (commandList: Array<Command>) {
        const preparedList = new Array();
        for (let command of commandList) {
            if (command.title !== 'copy logical name' && command.title !== 'copy physical name' && command.title !== 'copy json name' && command.title !== 'double click trigger command') {
                preparedList.push({ label: command.title, commandId: command.command });
            }
        }
        return preparedList;
    }

    async quickPickEntry () { // entry point called by command
        try {
            const simpliciteExtension = extensions.getExtension(EXTENSION_ID);
            if (simpliciteExtension === undefined) {
                throw new Error('No extension id available');
            }
            const commandList = simpliciteExtension.packageJSON.contributes.commands;
            const commandQuickPick = this.commandListQuickPick(commandList);
            const target = await window.showQuickPick(commandQuickPick);
            if (target) {
                try {
                    await commands.executeCommand(target.commandId, this.request);
                } catch (e) {
                    logger.error(e + 'Error occured while executing command');
                }
            }
        } catch(e) {
            logger.error(e);
        }    
    }
}