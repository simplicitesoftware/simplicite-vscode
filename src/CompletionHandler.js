'use strict';

const vscode = require('vscode');
const { crossPlatformPath } = require('./utils');
const FieldObjectTree = require('./FieldObjectTree');
const logger = require('./Log');

const triggerFunctions = ['getField', 'getFieldValue', 'setFieldValue'];

class CompletionHandler {
    constructor (request) {
		this.request = request;
        this.template = { scheme: 'file', language: 'java' };
		this.completionItemList = undefined;
		this.fieldObjectTree = new FieldObjectTree(request);
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
				this.activeEditorListener();
			} catch (e) {
				logger.error(e);
			}
		} else {
			this.currentPagePath = undefined;
			this.currentWorkspace = undefined;
			this.instanceUrl = undefined;
		}	
    }

	async asyncInit () {
		try {
			if (vscode.window.activeTextEditor.document.uri.path === undefined) throw 'No active text editor, cannot handle completion';
			this.completionItemList = await this.completionItemRender();
		} catch (e) {
			logger.error(e);
		}
	}

    provideCompletionItems(document, position) {
		try {
			const linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (linePrefix === -1) {
			  return []
			}
			
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
		const listener = vscode.window.onDidChangeActiveTextEditor(async event => {
			try {
				if (event !== undefined) {
					if (event.document.uri.path.includes('.java')) {
						self.currentPagePath = crossPlatformPath(event.document.fileName);
						self.currentWorkspace = self.getWorkspaceFromFileUri(event.document.uri);
						self.instanceUrl = self.request.moduleHandler.getModuleUrlFromWorkspacePath(self.currentWorkspace);
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
		const objectFieldsList = await this.request.getBusinessObjectFields(this.instanceUrl, this.request.moduleHandler.getModuleNameFromUrl(this.instanceUrl));
		//console.log(objectFieldsList);
		for (let item of objectFieldsList) {
			if (item.name === this.fileName) {
				for (let field of item.fields) {
					completionItems.push(new vscode.CompletionItem(field.name, vscode.CompletionItemKind.Text));
				}
				
			}
		}
		return completionItems;
	}

	getWorkspaceFromFileUri (uri) {
		try {
			const workspace = vscode.workspace.getWorkspaceFolder(uri);
			return crossPlatformPath(workspace.uri.path);
		} catch (e) {
			logger.warn(e);
		}
	}

	getFileNameFromPath (filePath) {
		try {
			const decomposedPath = filePath.split('/');
			return decomposedPath[decomposedPath.length - 1].replace('.java', '');
		} catch (e) {
			console.log(e);
		}
	}
}

module.exports = { 
    CompletionHandler: CompletionHandler
}