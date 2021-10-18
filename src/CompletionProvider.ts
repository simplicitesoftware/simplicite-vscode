// 'use strict';

// import { CompletionItem, window, CompletionItemProvider, TextDocument, Position, CompletionItemKind, Uri, workspace, CancellationToken, CompletionContext } from 'vscode';
// import { crossPlatformPath } from './utils';
// import { logger } from './Log';
// import { SimpliciteAPIManager } from './SimpliciteAPIManager';
// import { objectInfo } from './constant';

// export class CompletionProvider implements CompletionItemProvider {
// 	request: SimpliciteAPIManager;
// 	template: { scheme: string, language: string };
// 	completionItemList?: Array<CompletionItem>;
// 	currentPagePath?: string;
// 	fileName?: string;
// 	currentWorkspace?: string;
// 	instanceUrl?: string;
// 	currentObjectInfo?: { type: string, field: string };
// 	objectFieldsList?: any;
//     constructor (request: SimpliciteAPIManager) {
// 		this.request = request;
// 		this.completionItemList = undefined;
// 		if (request.moduleHandler.moduleLength() !== 0) {
// 			try {
// 				if (window.activeTextEditor === undefined) {
// 					throw new Error('No active text editor, cannot handle completion');
// 				}
// 				this.currentPagePath = crossPlatformPath(window.activeTextEditor.document.uri.path);
// 				this.fileName = this.getFileNameFromPath(this.currentPagePath);
// 				this.currentWorkspace = this.getWorkspaceFromFileUri(window.activeTextEditor.document.uri);
// 				if (this.currentWorkspace) {
// 					this.instanceUrl = this.request.moduleHandler.getModuleUrlFromWorkspacePath(this.currentWorkspace);
// 				}
// 				//this.activeEditorListener();
// 			} catch (e) {
// 				logger.error(e);
// 			}
// 		} else {
// 			this.reset();
// 		}	
//     }
	
// 	static async build (request: SimpliciteAPIManager) {
// 		const completionHandler = new CompletionProvider(request);
// 		try {
// 			if (window.activeTextEditor === undefined) {
// 				throw new Error ('No active text editor, cannot handle completion');
// 			}
// 			await completionHandler.getDataAndComputeCompletionItem();
// 		} catch (e) {
// 			logger.error(e);
// 		}
// 		return completionHandler;
// 	}

// 	private reset () {
// 		this.currentPagePath = undefined;
// 		this.fileName = undefined;
// 		this.currentWorkspace = undefined;
// 		this.instanceUrl = undefined;
// 		this.currentObjectInfo = undefined;
// 		this.completionItemList = undefined;
// 	}

// 	// trigger character is '"' (go to registerCompletionItemProvider)
// 	// but method is still called on every typed [a-z] character
// 	// same for https://github.com/microsoft/vscode-extension-samples/tree/main/completions-sample/src
// 	// cannot change this behavior so the only workaround
// 	// is to get the CompletionContext and check
// 	// for triggerKind === 1, meaning that the completion has 
// 	// been called with the proper trigger character
//     provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext) {
// 		if (context.triggerKind === 1) { 
// 			try {
// 				const linePrefix = document.lineAt(position).text.substr(0, position.character);
// 				for (let item of objectInfo) {
// 					if (item.objectType === this.currentObjectInfo?.type) {
// 						for (let func of item.functions) {
// 							if (linePrefix.endsWith(func + '("')) {
// 								return this.completionItemList;
// 							}
// 						}
// 					}
// 				}
// 			} catch (e) {
// 				logger.error(`provideCompletionItems: ${e}`);
// 			}
// 		}
//     }

// 	// activeEditorListener () {
// 	// 	window.onDidChangeActiveTextEditor(async event => {
// 	// 		try {
// 	// 			if (event !== undefined) {
// 	// 				if (event.document.uri.path.includes('.java')) {
// 	// 					this.currentPagePath = crossPlatformPath(event.document.fileName);
// 	// 					this.fileName = this.getFileNameFromPath(this.currentPagePath);
// 	// 					this.currentWorkspace = this.getWorkspaceFromFileUri(event.document.uri);
// 	// 					if (this.currentWorkspace) {
// 	// 						this.instanceUrl = this.request.moduleHandler.getModuleUrlFromWorkspacePath(this.currentWorkspace);
// 	// 					}
// 	// 					await this.getDataAndComputeCompletionItem();
// 	// 				} else {
// 	// 					this.reset();
// 	// 				}			
// 	// 			}
// 	// 		} catch (e) {
// 	// 			logger.error(e);
// 	// 		}
// 	// 	});
// 	// }

// 	private async getDataAndComputeCompletionItem (): Promise<void> {
// 		this.objectFieldsList = await this.getObjectFieldsList();
// 		this.currentObjectInfo = await this.getFileInfo();
// 		this.completionItemList = this.completionItemRender();
// 	}

// 	completionItemRender (): Array<CompletionItem> {
// 		const completionItems = new Array();
// 		try {
// 			if (this.currentObjectInfo === undefined) {
// 				throw new Error('Cannot process completion items with no info on the current object');
// 			}
// 			for (let objectType in this.objectFieldsList) {
// 				if (objectType === this.currentObjectInfo.type) {
// 					for (let object of this.objectFieldsList[objectType]) {
// 						if (object.name === this.fileName) {
// 							for (let item of object[this.currentObjectInfo.field]) {
// 								completionItems.push(new CompletionItem(item.name, CompletionItemKind.Text));
// 							}
// 						}
						
// 					}
// 				}
// 			}
// 		} catch (e) {
// 			logger.error(e);
// 		}
// 		return completionItems;
// 	}

// 	getWorkspaceFromFileUri (uri: Uri) {
// 		try {
// 			return crossPlatformPath(workspace.getWorkspaceFolder(uri)!.uri.path);
// 		} catch (e) {
// 			logger.warn(e);
// 		}
// 	}

// 	getFileNameFromPath (filePath?: string) {
// 		if (filePath === undefined) {
// 			throw new Error('Cannot identify the open file');
// 		}
// 		try {
// 			const decomposedPath = filePath.
// 			split('/');
// 			return decomposedPath[decomposedPath.length - 1].replace('.java', '');
// 		} catch (e) {
// 			logger.warn(e);
// 		}
// 	}

// 	private async getFileInfo (): Promise< { type: string, field: string }> {
// 		let fileType: { type: string, field: string } = { type: '', field: '' };
// 		for (let type in this.objectFieldsList) {
// 			if (this.objectFieldsList[type].length !== 0) {
// 				for (let object of this.objectFieldsList[type]) {
// 					if (object.name === this.fileName) {
// 						fileType = { type: type, field: this.getObjectField(type) };
// 					}
// 				}
// 			}
// 		}
// 		return fileType;
// 	}

// 	private getObjectField (type: string) {
// 		let field: string = '';
// 		for (let item of objectInfo) {
// 			if (item.objectType === type) {
// 				field = item.field;
// 			}
// 		}
// 		return field;
// 	}

// 	private async getObjectFieldsList () {
// 		let objectFieldsList: any = new Array();
// 		if (this.instanceUrl && this.currentWorkspace) {
// 			try {
// 				objectFieldsList = await this.request.getmoduleDevInfo(this.instanceUrl, getModuleName(this.currentWorkspace));
// 			} catch(e) {
// 				logger.warn('cannot handle completion, objectFieldList is empty');
// 			}
// 		}
// 		return objectFieldsList;
// 	}
// }

// function getModuleName (workspaceUrl: string): string {
// 	const decomposedUrl = workspaceUrl.split('/');
// 	return decomposedUrl[decomposedUrl.length - 1];
// }