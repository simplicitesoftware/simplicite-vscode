'use strict';

import { CompletionItem, CompletionItemProvider, TextDocument, Position, ProviderResult, CompletionList, CancellationToken, CompletionContext, CompletionItemKind, window, Disposable, languages, ExtensionContext } from 'vscode';
import { Completion, DevInfo, DevInfoObject } from './DevInfo';
import { removeFileExtension } from './utils';
import { CustomFile } from './CustomFile';
import { SimpliciteInstanceController } from './SimpliciteInstanceController';

let completionProvider: Disposable | undefined = undefined;

export async function completionProviderService(simpliciteInstanceController: SimpliciteInstanceController, context: ExtensionContext) {
    completionProvider = await prodiverMaker(simpliciteInstanceController, context);
    window.onDidChangeActiveTextEditor(async () => { // dispose the current completionProvider and initialize a new one
        if (completionProvider) completionProvider.dispose();
        completionProvider = await prodiverMaker(simpliciteInstanceController, context);
    });
}

const prodiverMaker = async function (simpliciteInstanceController: SimpliciteInstanceController, context: ExtensionContext): Promise<Disposable | undefined> {
    try {
        if(!window.activeTextEditor) return undefined;
        const fileUri = window.activeTextEditor.document.uri;
        simpliciteInstanceController.instances.forEach(instance => {
            instance.modules.forEach(module => {
                module.files.forEach(file => {
                    if(file.uri.path.toLowerCase() === fileUri.path.toLowerCase()) {
                        if(file.extension !== '.java') return undefined;
                        if(!simpliciteInstanceController.devInfo) throw new Error('devInfo is undefined, cannot init completion');
                        if(!module.moduleDevInfo) throw new Error('moduleDevInfo is undefined, cannot init completion');
                        return completionProviderHandler(simpliciteInstanceController.devInfo, module.moduleDevInfo, context, file);
                    }
                });
            });
        });
    } catch(e) {
        console.error(e);
        return undefined;
    }
};

function completionProviderHandler(devInfo: DevInfo, moduleDevInfo: any, context: ExtensionContext, file: CustomFile): Disposable {
	const devCompletionProvider = new CompletionProvider(devInfo, moduleDevInfo, file);
	const completionProvider = languages.registerCompletionItemProvider(TEMPLATE, devCompletionProvider, '"');
	context.subscriptions.push(completionProvider);
	console.log('Completion ready on ' + file.name);
	return completionProvider;
}

class CompletionProvider implements CompletionItemProvider {
	private _completionItems: CustomCompletionItem[];
	private _currentObjectInfo: any;
	private _genericObjectDevInfo?: DevInfoObject;
	private _file: CustomFile;
	constructor(devInfo: DevInfo, moduleDevInfo: any, file: CustomFile) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

	provideCompletionItems(document: TextDocument, position: Position, _token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
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
				console.error(`provideCompletionItems: ${e}`);
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
