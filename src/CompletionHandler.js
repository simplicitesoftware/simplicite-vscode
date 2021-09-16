'use strict';

const vscode = require('vscode');
const { crossPlatformPath } = require('./utils');

const triggerFunctions = ['getField', 'getFieldValue', 'setFieldValue'];

class CompletionHandler {
    constructor (request) {
		this.request = request;
        this.template = { scheme: 'file', language: 'java' };
		this.completionItemList = undefined;
		if (request.moduleHandler.moduleLength() !== 0) {
			this.currentPagePath = crossPlatformPath(vscode.window.activeTextEditor.document.uri.path);
			this.fileName = this.getFileNameFromPath(this.currentPagePath);
			this.currentWorkspace = this.getWorkspaceFromFileUri(vscode.window.activeTextEditor.document.uri);
			this.instanceUrl = this.request.moduleHandler.getModuleUrlFromWorkspacePath(this.currentWorkspace);
			this.activeEditorListener();
		} else {
			this.currentPagePath = undefined;
			this.currentWorkspace = undefined;
			this.instanceUrl = undefined;
		}	
    }

	async asyncInit () {
		this.completionItemList = await this.completionItemRender();
	}

    provideCompletionItems(document, position) {
		try {
			const linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (linePrefix === -1) {
			  return []
			}
	
			if (linePrefix.split('(').length > 2) {
				console.log(linePrefix.split('('));
			}
		
			const cleanPrefix = linePrefix.replace('(', '').replace('\t', '').replace('\'', '').replace('"', '');
			console.log(cleanPrefix);
			for (let functionName of triggerFunctions) {
				if (functionName === cleanPrefix) {
					console.log('implement completion');
					return this.completionItemList;
				}
			}
		} catch (e) {
			console.log(e);
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
		const objectFieldsList = await this.request.getBusinessObjectFields(this.instanceUrl);
		console.log(objectFieldsList);
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
			console.log(e);
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