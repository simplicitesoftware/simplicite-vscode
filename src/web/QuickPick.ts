'use strict';

import { commands, Command, extensions, window, Disposable, QuickPickItemKind, QuickPickItem } from 'vscode';

// Quick pick shows a list of the extensions commands
export class QuickPick {
	static separatorCoordinates = [
		{index: 0, label: 'Apply Changes'}, 
		{index: 3, label: 'Authentication'},
		{index: 7, label: 'Api Module'},
		{index: 9, label: 'Others'}
	];

	static excludedCommand = [
		'copy logical name', 'copy physical name', 'copy json name', 'double click trigger command', 
		'Simplicite: Track file', 'Simplicite: Untrack file', 'Simplicite: Refresh the Module Info tree view', 
		'Simplicite: Refresh the File Handler tree view', 'Simplicite: Debug'
	];

	private static getSeperatorFromIndex(index: number) {
		return QuickPick.separatorCoordinates.find(val => val.index === index);
	}

	static commandListQuickPick(commandList: Array<Command>): CustomItem[] {
		const preparedList = [];
		let i = 0;
		for (const command of commandList) {
			const separator = QuickPick.getSeperatorFromIndex(i);
			if(separator) {
				preparedList.push({ label: separator.label, kind: QuickPickItemKind.Separator});
			}
			if (!this.excludedCommand.includes(command.title)) {
				preparedList.push({ label: command.title, commandId: command.command });
				i++;
			}		
		}
		return preparedList;
	}

	static async quickPickEntry(): Promise<void> { // entry point called by command
		try {
			const simpliciteExtension = extensions.getExtension(EXTENSION_ID);
			if (simpliciteExtension === undefined) {
				throw new Error('No extension id available');
			}
			const commandList = simpliciteExtension.packageJSON.contributes.commands;
			const commandQuickPick = this.commandListQuickPick(commandList);
			const target = await window.showQuickPick(commandQuickPick);
			if (target && target.commandId) {
				try {
					await commands.executeCommand(target.commandId);
				} catch (e) {
					console.error(e + 'Error occured while executing command');
				}
			}
		} catch (e) {
			console.error(e);
		}
	}
}

class CustomItem implements QuickPickItem {
	label: string;
	commandId?: string;
	kind?: QuickPickItemKind;
	constructor(label: string, commandId?: string, kind?: QuickPickItemKind) {
		this.label = label;
		this.commandId = commandId;
		this.kind = kind;
	}
}