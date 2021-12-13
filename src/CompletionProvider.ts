/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
'use strict';

import { CompletionItem, Uri, CompletionItemProvider, TextDocument, Position, ProviderResult, CompletionList, workspace, CancellationToken, CompletionContext, CompletionItemKind } from 'vscode';
import { logger } from './Log';
import { ModuleDevInfo } from './interfaces';
import { removeFileExtension } from './utils';
import { File } from './File';

export class CompletionProvider implements CompletionItemProvider {
	private _devInfo: any;
	private _moduleDevInfo: any;
	private _file: File;
	private _fileInfo: ModuleDevInfo | undefined;
	private _completionItems: CustomCompletionItem[];
	constructor(devInfo: any, moduleDevInfo: any, file: File,) {
		this._devInfo = devInfo;
		this._moduleDevInfo = moduleDevInfo;
		this._file = file;
		this._fileInfo = this.getFileObject();
		this._completionItems = this.computeCompletionItems();
	}

	private computeCompletionItems(): CustomCompletionItem[] {
		try {
			if (!this._fileInfo || !this._fileInfo.completion) {
				return [];
			}
			const completionItems: CustomCompletionItem[] = [];
			for (const objectType in this._moduleDevInfo) {
				if (objectType === this._fileInfo.object) {
					for (const object of this._moduleDevInfo[objectType]) {
						const fileName = CompletionProvider.getFileNameFromPath(this._file.path);
						if (object.name === fileName) {
							for (const completionAttribute in this._fileInfo.completion) {
								// eslint-disable-next-line no-prototype-builtins
								if (object.hasOwnProperty(completionAttribute)) {
									for (const item of object[completionAttribute]) {
										completionItems.push(new CustomCompletionItem(item.name, CompletionItemKind.Text, completionAttribute));
									}
								}
							}
						}
					}
				}
			}
			return completionItems;
		} catch (e) {
			logger.error(e);
		}
		return [];
	}

	provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
		if (context.triggerKind === 1) {
			try {
				const linePrefix = document.lineAt(position).text.substr(0, position.character);
				if (!this._fileInfo || !this._fileInfo.completion) {
					return [];
				}
				for (const completionItem in this._fileInfo.completion) {
					// eslint-disable-next-line no-prototype-builtins
					if (this._fileInfo.completion.hasOwnProperty(completionItem)) {
						for (const func of this._fileInfo.completion[completionItem]) {
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

	private getFileObject(): ModuleDevInfo | undefined {
		let fileObject: ModuleDevInfo | undefined = undefined;
		for (const object of this._devInfo.objects) {
			if (!object.package) continue;

			if (this.doesFilePathContainsObjectPackage(object.package)) {
				fileObject = object;
			}
		}
		return fileObject;
	}

	private doesFilePathContainsObjectPackage(objectPackage: string): boolean {
		const packagePathFormat = objectPackage.replace(/\./g, '/');
		if (this._file.path.includes(packagePathFormat)) {
			return true;
		}
		return false;
	}
}



class CustomCompletionItem extends CompletionItem {
	attributeName: string;
	constructor(label: string, kind: CompletionItemKind, attributeName: string) {
		super(label, kind);
		this.attributeName = attributeName;
	}
}
