'use strict';

<<<<<<< HEAD
import { commands, CompletionItem, window, CompletionItemProvider, TextDocument, Position, CompletionItemKind, Uri, workspace } from 'vscode';
import { crossPlatformPath } from './utils';
import { FieldObjectTree } from './FieldObjectTree';
import { logger } from './Log';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';

const triggerFunctions = ['getField', 'getFieldValue', 'setFieldValue'];

export class CompletionHandler implements CompletionItemProvider {
	request: SimpliciteAPIManager;
	template: { scheme: string, language: string };
	completionItemList?: Array<CompletionItem>;
	fieldObjectTree: any; // peut changer
	currentPagePath?: string;
	fileName?: string;
	currentWorkspace?: string
	instanceUrl?: string;
    constructor (request: SimpliciteAPIManager) {
=======
import * as vscode from 'vscode';
const { crossPlatformPath } = require('./utils');
const FieldObjectTree = require('./FieldObjectTree');
const logger = require('./Log');

const triggerFunctions = ['getField', 'getFieldValue', 'setFieldValue'];

class CompletionHandler {
    constructor (request) {
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
		this.request = request;
        this.template = { scheme: 'file', language: 'java' };
		this.completionItemList = undefined;
		this.fieldObjectTree = new FieldObjectTree(request);
<<<<<<< HEAD
		window.registerTreeDataProvider(
			'simpliciteObjectFields',
			this.fieldObjectTree
		)
		commands.registerCommand('simplicite-vscode.refreshTreeView', async () => this.fieldObjectTree.refresh());
		
		if (request.moduleHandler.moduleLength() !== 0) {
			try {
				if (window.activeTextEditor === undefined) throw 'No active text editor, cannot handle completion';
				this.currentPagePath = crossPlatformPath(window.activeTextEditor.document.uri.path);
				this.fileName = this.getFileNameFromPath(this.currentPagePath);
				this.currentWorkspace = this.getWorkspaceFromFileUri(window.activeTextEditor.document.uri);
				if (this.currentWorkspace) this.instanceUrl = this.request.moduleHandler.getModuleUrlFromWorkspacePath(this.currentWorkspace);
=======
		vscode.window.registerTreeDataProvider(
			'simpliciteObjectFields',
			this.fieldObjectTree
		)
		vscode.commands.registerCommand('simplicite-vscode.refreshTreeView', async () => this.fieldObjectTree.refresh());
		
		if (request.moduleHandler.moduleLength() !== 0) {
			try {
				if (vscode.window.activeTextEditor === undefined) throw 'No active text editor, cannot handle completion';
				this.currentPagePath = crossPlatformPath(vscode.window.activeTextEditor.document.uri.path);
				this.fileName = this.getFileNameFromPath(this.currentPagePath);
				this.currentWorkspace = this.getWorkspaceFromFileUri(vscode.window.activeTextEditor.document.uri);
				this.instanceUrl = this.request.moduleHandler.getModuleUrlFromWorkspacePath(this.currentWorkspace);
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
				this.activeEditorListener();
			} catch (e) {
				logger.error(e);
			}
		} else {
			this.currentPagePath = undefined;
<<<<<<< HEAD
			this.fileName = undefined;
=======
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
			this.currentWorkspace = undefined;
			this.instanceUrl = undefined;
		}	
    }

	async asyncInit () {
		try {
<<<<<<< HEAD
			if (window.activeTextEditor === undefined) throw 'No active text editor, cannot handle completion';
=======
			if (vscode.window.activeTextEditor.document.uri.path === undefined) throw 'No active text editor, cannot handle completion';
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
			this.completionItemList = await this.completionItemRender();
		} catch (e) {
			logger.error(e);
		}
		
	}

<<<<<<< HEAD
    provideCompletionItems(document: TextDocument, position: Position) {
		try {
			const linePrefix = document.lineAt(position).text.substr(0, position.character);
=======
    provideCompletionItems(document, position) {
		try {
			const linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (linePrefix === -1) {
			  return []
			}
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
			
			for (let functionName of triggerFunctions) {
				if (linePrefix.endsWith(functionName + '(\'')) {
					return this.completionItemList;
				}
			}
		} catch (e) {
			logger.error(`provideCompletionItems: ${e}`);
		}
        
    }

	activeEditorListener () {
		const self = this;
<<<<<<< HEAD
		const listener = window.onDidChangeActiveTextEditor(async event => {
=======
		const listener = vscode.window.onDidChangeActiveTextEditor(async event => {
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
			try {
				if (event !== undefined) {
					if (event.document.uri.path.includes('.java')) {
						self.currentPagePath = crossPlatformPath(event.document.fileName);
						self.currentWorkspace = self.getWorkspaceFromFileUri(event.document.uri);
<<<<<<< HEAD
						if (self.currentWorkspace) self.instanceUrl = self.request.moduleHandler.getModuleUrlFromWorkspacePath(self.currentWorkspace);
=======
						self.instanceUrl = self.request.moduleHandler.getModuleUrlFromWorkspacePath(self.currentWorkspace);
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
						self.completionItemList = await self.completionItemRender();
						//await self.request.getBusinessObjectFields(self.instanceUrl);
					} else {
						self.currentPagePath = undefined;
						self.currentWorkspace = undefined;
						self.instanceUrl = undefined;
					}			
				}
			} catch (e) {
				console.log(e);
			}
			
		})
	}

	async completionItemRender () {
		const completionItems = new Array();
<<<<<<< HEAD
		let objectFieldsList;
		if (this.instanceUrl) {
			objectFieldsList = await this.request.getBusinessObjectFields(this.instanceUrl, this.request.moduleHandler.getModuleNameFromUrl(this.instanceUrl));
		}
=======
		const objectFieldsList = await this.request.getBusinessObjectFields(this.instanceUrl, this.request.moduleHandler.getModuleNameFromUrl(this.instanceUrl));
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
		//console.log(objectFieldsList);
		for (let item of objectFieldsList) {
			if (item.name === this.fileName) {
				for (let field of item.fields) {
<<<<<<< HEAD
					completionItems.push(new CompletionItem(field.name, CompletionItemKind.Text));
=======
					completionItems.push(new vscode.CompletionItem(field.name, vscode.CompletionItemKind.Text));
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
				}
				
			}
		}
		return completionItems;
	}

<<<<<<< HEAD
	getWorkspaceFromFileUri (uri: Uri) {
		try {
			return crossPlatformPath(workspace.getWorkspaceFolder(uri)!.uri.path);
=======
	getWorkspaceFromFileUri (uri) {
		try {
			const workspace = vscode.workspace.getWorkspaceFolder(uri);
			return crossPlatformPath(workspace.uri.path);
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
		} catch (e) {
			logger.warn(e);
		}
	}

<<<<<<< HEAD
	getFileNameFromPath (filePath?: string) {
		if (filePath === undefined) throw 'Cannot identify the open file';
=======
	getFileNameFromPath (filePath) {
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
		try {
			const decomposedPath = filePath.split('/');
			return decomposedPath[decomposedPath.length - 1].replace('.java', '');
		} catch (e) {
			console.log(e);
		}
	}
<<<<<<< HEAD
=======
}

module.exports = { 
    CompletionHandler: CompletionHandler
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
}