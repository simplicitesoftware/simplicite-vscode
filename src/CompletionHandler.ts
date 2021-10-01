'use strict';

import { CompletionItem, window, CompletionItemProvider, TextDocument, Position, CompletionItemKind, Uri, workspace } from 'vscode';
import { crossPlatformPath } from './utils';
import { logger } from './Log';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { type } from 'os';
import { stringify } from 'querystring';

interface TriggerFunctionsObject {
	objectType: string,
	functions: Array<string>,
	field: string
}

const triggerFunctions: Array<TriggerFunctionsObject> = [
	{
		objectType: 'ObjectInternal',
		functions: ['getField', 'getFieldValue', 'setFieldValue'],
		field: 'fields'
	},
	{
		objectType: 'ObjectExternal',
		functions: ['getField', 'getFieldValue', 'setFieldValue'],
		field: 'actions'
	},
	{
		objectType: 'BPMProcess',
		functions: ['getField', 'getFieldValue', 'setFieldValue'],
		field: 'activities'
	},
];

export class CompletionHandler implements CompletionItemProvider {
	request: SimpliciteAPIManager;
	template: { scheme: string, language: string };
	completionItemList?: Array<CompletionItem>;
	currentPagePath?: string;
	fileName?: string;
	currentWorkspace?: string;
	instanceUrl?: string;
	currentObjectInfo?: { type: string, field: string };
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
			this.currentObjectInfo = await this.getFileInfo();
		} catch (e) {
			logger.error(e);
		}
	}

    provideCompletionItems(document: TextDocument, position: Position) {
		try {
			const linePrefix = document.lineAt(position).text.substr(0, position.character);
			
			for (let item of triggerFunctions) {
				for (let func of item.functions) {
					if (linePrefix.endsWith(func + '(\'')) {
						console.log('completion');
						return this.completionItemList;
					}
				}
			}
		} catch (e) {
			logger.error(`provideCompletionItems: ${e}`);
		} 
    }

	activeEditorListener () {
		const listener = window.onDidChangeActiveTextEditor(async event => {
			try {
				if (event !== undefined) {
					if (event.document.uri.path.includes('.java')) {
						this.currentPagePath = crossPlatformPath(event.document.fileName);
						this.currentWorkspace = this.getWorkspaceFromFileUri(event.document.uri);
						if (this.currentWorkspace) {
							this.instanceUrl = this.request.moduleHandler.getModuleUrlFromWorkspacePath(this.currentWorkspace);
						}
						this.currentObjectInfo = await this.getFileInfo();
						this.completionItemList = await this.completionItemRender();
					} else {
						this.currentPagePath = undefined;
						this.currentWorkspace = undefined;
						this.instanceUrl = undefined;
					}			
				}
			} catch (e) {
				logger.error(e);
			}
		});
	}

	async completionItemRender (): Promise<Array<CompletionItem>> {
		const completionItems = new Array();
		try {
			if (this.currentObjectInfo === undefined) {
				throw new Error('Cannot process completion items with no info on the current object');
			}
			let objectFieldsList: any = await this.getObjectFieldsList();
			for (let objectType in objectFieldsList) {
				if (objectType === this.currentObjectInfo.type) {
					for (let object of objectFieldsList[objectType]) {
						for (let item of object[this.currentObjectInfo.field]) {
							completionItems.push(new CompletionItem(item.name, CompletionItemKind.Text));
						}
					}
				}
			}
		} catch (e) {
			logger.error(e);
		}
		return completionItems;
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
			const decomposedPath = filePath.
			split('/');
			return decomposedPath[decomposedPath.length - 1].replace('.java', '');
		} catch (e) {
			logger.warn(e);
		}
	}

	private async getFileInfo (): Promise< { type: string, field: string }> {
		let fileType: { type: string, field: string } = { type: '', field: '' };
		let objectFieldsList: any = await this.getObjectFieldsList();
		for (let type in objectFieldsList) {
			if (objectFieldsList[type].length !== 0) {
				for (let object of objectFieldsList[type]) {
					if (object.name === this.fileName) {
						fileType = { type: type, field: this.getObjectField(type) };
					}
				}
			}
		}
		return fileType;
	}

	private getObjectField (type: string) {
		let field: string = '';
		for (let item of triggerFunctions) {
			if (item.objectType === type) {
				field = item.field;
			}
		}
		return field;
	}

	private async getObjectFieldsList () {
		let objectFieldsList: any = new Array();
		if (this.instanceUrl) {
			try {
				objectFieldsList = await this.request.getmoduleDevInfo(this.instanceUrl, this.request.moduleHandler.getModuleNameFromUrl(this.instanceUrl));
			} catch(e) {
				console.log(e);
			}
		}
		return objectFieldsList;
	}
}