// 'use strict';

// import { commands, Command, extensions, window, Disposable } from 'vscode';
// import { logger } from './Log';
// import { SimpliciteApiController } from './SimpliciteApiController';

// export class QuickPick {
// 	private _simpliciteApiController: SimpliciteApiController;
// 	constructor(subscriptions: Disposable[], simpliciteApiController: SimpliciteApiController) {
// 		this._simpliciteApiController = simpliciteApiController;
// 		subscriptions.push(commands.registerCommand(SHOW_SIMPLICITE_COMMAND_ID, async () => await this.quickPickEntry()));
// 	}

// 	commandListQuickPick(commandList: Array<Command>): { label: string, commandId: string }[] {
// 		const preparedList = [];
// 		for (const command of commandList) {
// 			if (command.title !== 'copy logical name' && command.title !== 'copy physical name' && command.title !== 'copy json name' && command.title !== 'double click trigger command') {
// 				preparedList.push({ label: command.title, commandId: command.command });
// 			}
// 		}
// 		return preparedList;
// 	}

// 	async quickPickEntry(): Promise<void> { // entry point called by command
// 		try {
// 			const simpliciteExtension = extensions.getExtension(EXTENSION_ID);
// 			if (simpliciteExtension === undefined) {
// 				throw new Error('No extension id available');
// 			}
// 			const commandList = simpliciteExtension.packageJSON.contributes.commands;
// 			const commandQuickPick = this.commandListQuickPick(commandList);
// 			const target = await window.showQuickPick(commandQuickPick);
// 			if (target) {
// 				try {
// 					await commands.executeCommand(target.commandId, this._simpliciteApiController);
// 				} catch (e) {
// 					logger.error(e + 'Error occured while executing command');
// 				}
// 			}
// 		} catch (e) {
// 			logger.error(e);
// 		}
// 	}
// }