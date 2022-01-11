/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
'use strict';

import { CompletionItem, Uri, CompletionItemProvider, TextDocument, Position, ProviderResult, CompletionList, workspace, CancellationToken, CompletionContext, CompletionItemKind } from 'vscode';
import { logger } from './Log';
import { Completion, DevInfo, DevInfoObject } from './DevInfo';
import { removeFileExtension } from './utils';
import { File } from './File';

export class CompletionProvider implements CompletionItemProvider {
	private _completionItems: CustomCompletionItem[];
	private _currentObjectInfo: any;
	private _genericObjectDevInfo?: DevInfoObject;
	private _file: File;
	constructor(devInfo: DevInfo, moduleDevInfo: any, file: File,) {
		this._currentObjectInfo = moduleDevInfo[file.type!];
		this._genericObjectDevInfo = this._getDevInfoGenericObjectInfo(file.type, devInfo);
		this._file = file;
		this._completionItems = this.computeCompletionItems();
	}

	private _getDevInfoGenericObjectInfo (currentObjectType: string | undefined, devInfo: DevInfo): DevInfoObject | undefined {
		for (const devObject of devInfo.objects) {
			if (devObject.object === currentObjectType)	return devObject;
		}
	}

	private computeCompletionItems(): CustomCompletionItem[] {
		if (!this._currentObjectInfo || !this._genericObjectDevInfo || !this._genericObjectDevInfo.completion ) {
			return [];	
		}
		const completionItems = [];
		const fileName = CompletionProvider.getFileNameFromPath(this._file.uri.path);
		for (const object of this._currentObjectInfo) {
			if (object.name === fileName) {
				for (const completionAttribute in this._genericObjectDevInfo.completion) {
					if (object.hasOwnProperty(completionAttribute)) {
						for (const item of object[completionAttribute]) {
							completionItems.push(new CustomCompletionItem(item.name, CompletionItemKind.Text, completionAttribute));
						}
					}
				}
			}
		}
		return completionItems;
	}

	provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
		if (context.triggerKind === 1) {
			try {
				const linePrefix = document.lineAt(position).text.substr(0, position.character);
				if (!this._genericObjectDevInfo || !this._genericObjectDevInfo.completion) {
					return [];
				}
				for (const completionItem in this._genericObjectDevInfo.completion) {
					// eslint-disable-next-line no-prototype-builtins
					if (this._genericObjectDevInfo.completion.hasOwnProperty(completionItem)) {
						for (const func of this._genericObjectDevInfo.completion[completionItem as keyof Completion]) {
							if (linePrefix.endsWith(func + '("')) {
								const specificProperty = this.getSpecificPropertyItems(completionItem);
								return specificProperty;
							}
						}
					}
				}
			} catch (e) {
				logger.error(`provideCompletionItems: ${e}`);
			}
		}
		return [];
	}

	private getSpecificPropertyItems(completionItem: string): CustomCompletionItem[] {
		const specificItems = [];
		for (const item of this._completionItems) {
			if (item.attributeName === completionItem) {
				specificItems.push(item);
			}
		}
		return specificItems;
	}

	static getFileNameFromPath(filePath: string): string {
		const decomposedPath = filePath.split('/');
		return removeFileExtension(decomposedPath[decomposedPath.length - 1]);
	}
}

class CustomCompletionItem extends CompletionItem {
	attributeName: string;
	constructor(label: string, kind: CompletionItemKind, attributeName: string) {
		super(label, kind);
		this.attributeName = attributeName;
	}
}
