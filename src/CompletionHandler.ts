'use strict';

import { CompletionItem, window, CompletionItemProvider, TextDocument, Position, CompletionItemKind, Uri, workspace } from 'vscode';
import { crossPlatformPath } from './utils';
import { logger } from './Log';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';

const triggerFunctions = ['getField', 'getFieldValue', 'setFieldValue'];

export class CompletionHandler implements CompletionItemProvider {
	request: SimpliciteAPIManager;
	template: { scheme: string, language: string };
	completionItemList?: Array<CompletionItem>;
	currentPagePath?: string;
	fileName?: string;
	currentWorkspace?: string;
	instanceUrl?: string;
    constructor (request: SimpliciteAPIManager) {
		this.request = request;
        this.template = { scheme: 'file', language: 'java' };
		this.completionItemList = undefined;
		if (request.moduleHandler.moduleLength() !== 0) {
			try {
				if (window.activeTextEditor === undefined) {
					throw new Error('No active text editor, cannot handle completion');
				} 
				this.currentPagePath = crossPlatformPath(window.activeTextEditor.document.uri.path);
				this.fileName = this.getFileNameFromPath(this.currentPagePath);
				this.currentWorkspace = this.getWorkspaceFromFileUri(window.activeTextEditor.document.uri);
				if (this.currentWorkspace) {
					this.instanceUrl = this.request.moduleHandler.getModuleUrlFromWorkspacePath(this.currentWorkspace);
				}
				this.activeEditorListener();
			} catch (e) {
				logger.error(e);
			}
		} else {
			this.currentPagePath = undefined;
			this.fileName = undefined;
			this.currentWorkspace = undefined;
			this.instanceUrl = undefined;
		}	
    }
	
	static async build (request: SimpliciteAPIManager) {
		const completionHandler = new CompletionHandler(request);
		await completionHandler.init();
		return completionHandler;
	}
	
	private async init () {
		try {
			if (window.activeTextEditor === undefined) {
				throw new Error ('No active text editor, cannot handle completion');
			}
			this.completionItemList = await this.completionItemRender();
		} catch (e) {
			logger.error(e);
		}
	}

    provideCompletionItems(document: TextDocument, position: Position) {
		try {
			const linePrefix = document.lineAt(position).text.substr(0, position.character);
			
			for (let functionName of triggerFunctions) {
				if (linePrefix.endsWith(functionName + '(\'')) {
					console.log('completion');
					return this.completionItemList;
				}
			}
		} catch (e) {
			logger.error(`provideCompletionItems: ${e}`);
		}
        
    }

	activeEditorListener () {
		const self = this;
		const listener = window.onDidChangeActiveTextEditor(async event => {
			try {
				if (event !== undefined) {
					if (event.document.uri.path.includes('.java')) {
						self.currentPagePath = crossPlatformPath(event.document.fileName);
						self.currentWorkspace = self.getWorkspaceFromFileUri(event.document.uri);
						if (self.currentWorkspace) {
							self.instanceUrl = self.request.moduleHandler.getModuleUrlFromWorkspacePath(self.currentWorkspace);
						}
						self.completionItemList = await self.completionItemRender();
						//await self.request.getBusinessObjectFields(self.instanceUrl);
					} else {
						self.currentPagePath = undefined;
						self.currentWorkspace = undefined;
						self.instanceUrl = undefined;
					}			
				}
			} catch (e) {
				logger.error(e);
			}
		});
	}

	async completionItemRender () {
		const completionItems = new Array();
		let objectFieldsList;
		try {
			if (this.instanceUrl) {
				objectFieldsList = await this.request.getBusinessObjectFields(this.instanceUrl, this.request.moduleHandler.getModuleNameFromUrl(this.instanceUrl));
			}
			for (let item of objectFieldsList) {
				if (item.name === this.fileName) {
					for (let field of item.fields) {
						completionItems.push(new CompletionItem(field.name, CompletionItemKind.Text));
					}
					
				}
			}
			return completionItems;
		} catch (e) {
			logger.error(e);
		}
		
	}

	getWorkspaceFromFileUri (uri: Uri) {
		try {
			return crossPlatformPath(workspace.getWorkspaceFolder(uri)!.uri.path);
		} catch (e) {
			logger.warn(e);
		}
	}

	getFileNameFromPath (filePath?: string) {
		if (filePath === undefined) {
			throw new Error('Cannot identify the open file');
		}
		try {
			const decomposedPath = filePath.split('/');
			return decomposedPath[decomposedPath.length - 1].replace('.java', '');
		} catch (e) {
			console.log(e);
		}
	}
}