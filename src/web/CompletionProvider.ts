// /* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// 'use strict';

// import { CompletionItem, CompletionItemProvider, TextDocument, Position, ProviderResult, CompletionList, CancellationToken, CompletionContext, CompletionItemKind, window, Disposable, languages } from 'vscode';
// import { logger } from './Log';
// import { Completion, DevInfo, DevInfoObject } from './DevInfo';
// import { removeFileExtension } from './utils';
// import { File } from './File';



// let completionProvider: Disposable | undefined = undefined;
// const prodiverMaker = async function (): Promise<Disposable | undefined> { // see following try catch and onDidChangeActiveTextEditor
// 	const connectedInstances: string[] = moduleHandler.connectedInstances;
// 	if (connectedInstances.length > 0
// 		&& simpliciteApi.devInfo
// 		&& moduleHandler.modules.length
// 		&& window.activeTextEditor) {
// 		const filePath = window.activeTextEditor.document.uri.path;
// 		const file = fileHandler.getFileFromFullPath(filePath);
// 		if (file.extension !== '.java') {
// 			return undefined;
// 		}
// 		// set the api file info onDidChangeActiveTextEditor
// 		const module = moduleHandler.getModuleFromWorkspacePath(file.workspaceFolderPath);
// 		if (!module || !module.moduleDevInfo) {
// 			return undefined;
// 		}
// 		if (!connectedInstances.includes(file.simpliciteUrl)) {
// 			logger.warn('Cannot provide completion, not connected to the module\'s instance');
// 			return undefined;
// 		}
// 		completionProvider = completionProviderHandler(simpliciteApi.devInfo, module.moduleDevInfo, context, file);
// 		return completionProvider;
// 	}
// 	return undefined;
// };

// window.onDidChangeActiveTextEditor(async () => { // dispose the current completionProvider and initialize a new one
// 	try {
// 		if (!completionProvider) {
// 			completionProvider = await prodiverMaker();
// 		} else {
// 			completionProvider.dispose();
// 			completionProvider = await prodiverMaker();
// 		}
// 	} catch (e) {
// 		logger.error(e);
// 	}
// });

// function completionProviderHandler(devInfo: DevInfo, moduleDevInfo: any, context: ExtensionContext, file: File): Disposable {
// 	const devCompletionProvider = new CompletionProvider(devInfo, moduleDevInfo, file);
// 	const completionProvider = languages.registerCompletionItemProvider(TEMPLATE, devCompletionProvider, '"');
// 	context.subscriptions.push(completionProvider);
// 	logger.info('completion ready');
// 	return completionProvider;
// }



// try {
// 	completionProvider = await prodiverMaker(); // on start completion initialization
// } catch (e) {
// 	logger.error(e);
// }

// export class CompletionProvider implements CompletionItemProvider {
// 	private _completionItems: CustomCompletionItem[];
// 	private _currentObjectInfo: any;
// 	private _genericObjectDevInfo?: DevInfoObject;
// 	private _file: File;
// 	constructor(devInfo: DevInfo, moduleDevInfo: any, file: File,) {
// 		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
// 		this._currentObjectInfo = moduleDevInfo[file.type!];
// 		this._genericObjectDevInfo = this._getDevInfoGenericObjectInfo(file.type, devInfo);
// 		this._file = file;
// 		this._completionItems = this.computeCompletionItems();
// 	}	

// 	private _getDevInfoGenericObjectInfo (currentObjectType: string | undefined, devInfo: DevInfo): DevInfoObject | undefined {
// 		for (const devObject of devInfo.objects) {
// 			if (devObject.object === currentObjectType)	return devObject;
// 		}
// 	}

// 	private computeCompletionItems(): CustomCompletionItem[] {
// 		if (!this._currentObjectInfo || !this._genericObjectDevInfo || !this._genericObjectDevInfo.completion ) {
// 			return [];	
// 		}
// 		const completionItems = [];
// 		const fileName = CompletionProvider.getFileNameFromPath(this._file.uri.path);
// 		for (const object of this._currentObjectInfo) {
// 			if (object.name === fileName) {
// 				for (const completionAttribute in this._genericObjectDevInfo.completion) {
// 					if (object.hasOwnProperty(completionAttribute)) {
// 						for (const item of object[completionAttribute]) {
// 							completionItems.push(new CustomCompletionItem(item.name, CompletionItemKind.Text, completionAttribute));
// 						}
// 					}
// 				}
// 			}
// 		}
// 		return completionItems;
// 	}

// 	provideCompletionItems(document: TextDocument, position: Position, _token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
// 		if (context.triggerKind === 1) {
// 			try {
// 				const linePrefix = document.lineAt(position).text.substr(0, position.character);
// 				if (!this._genericObjectDevInfo || !this._genericObjectDevInfo.completion) {
// 					return [];
// 				}
// 				for (const completionItem in this._genericObjectDevInfo.completion) {
// 					// eslint-disable-next-line no-prototype-builtins
// 					if (this._genericObjectDevInfo.completion.hasOwnProperty(completionItem)) {
// 						for (const func of this._genericObjectDevInfo.completion[completionItem as keyof Completion]) {
// 							if (linePrefix.endsWith(func + '("')) {
// 								const specificProperty = this.getSpecificPropertyItems(completionItem);
// 								return specificProperty;
// 							}
// 						}
// 					}
// 				}
// 			} catch (e) {
// 				logger.error(`provideCompletionItems: ${e}`);
// 			}
// 		}
// 		return [];
// 	}

// 	private getSpecificPropertyItems(completionItem: string): CustomCompletionItem[] {
// 		const specificItems = [];
// 		for (const item of this._completionItems) {
// 			if (item.attributeName === completionItem) {
// 				specificItems.push(item);
// 			}
// 		}
// 		return specificItems;
// 	}

// 	static getFileNameFromPath(filePath: string): string {
// 		const decomposedPath = filePath.split('/');
// 		return removeFileExtension(decomposedPath[decomposedPath.length - 1]);
// 	}
// }

// class CustomCompletionItem extends CompletionItem {
// 	attributeName: string;
// 	constructor(label: string, kind: CompletionItemKind, attributeName: string) {
// 		super(label, kind);
// 		this.attributeName = attributeName;
// 	}
// }
