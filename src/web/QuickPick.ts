'use strict';

import { commands, Command, extensions, window, Disposable } from 'vscode';
import { logger } from './Log';

// Quick pick shows a list of the extensions commands
export class QuickPick {
	excludedCommand: String[];
	constructor(subscriptions: Disposable[]) {
		this.excludedCommand = ['copy logical name', 'copy physical name', 'copy json name', 'double click trigger command', 
			'Simplicite: Track file', 'Simplicite: Untrack file', 'Simplicite: Refresh the Module Info tree view', 'Simplicite: Refresh the File Handler tree view', 'Simplicite: Debug'
		];
		subscriptions.push(commands.registerCommand(SHOW_SIMPLICITE_COMMAND_ID, async () => await this.quickPickEntry()));
	}

	commandListQuickPick(commandList: Array<Command>): { label: string, commandId: string }[] {
		const preparedList = [];
		for (const command of commandList) {
			if (!this.excludedCommand.includes(command.title)) {
				preparedList.push({ label: command.title, commandId: command.command });
			}
		}
		return preparedList;
	}

	async quickPickEntry(): Promise<void> { // entry point called by command
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
					await commands.executeCommand(target.commandId);
				} catch (e) {
					logger.error(e + 'Error occured while executing command');
				}
			}
		} catch (e) {
			logger.error(e);
		}
	}
}