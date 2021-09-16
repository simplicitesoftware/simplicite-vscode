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
			this.currentWorkspace = this.getWorkspaceFromFileUri(vscode.window.activeTextEditor.document.uri);
			this.instanceUrl = this.request.moduleHandler.getModuleUrlFromWorkspacePath(this.currentWorkspace);
			this.activeEditorListener();
		} else {
			this.currentPagePath = undefined;
			this.currentWorkspace = undefined;
			this.instanceUrl = undefined;
		}
			
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
		const listener = vscode.window.onDidChangeActiveTextEditor(async event => {
			try {
				if (event !== undefined) {
					if (event.document.uri.path.includes('.java')) {
						this.currentPagePath = crossPlatformPath(event.document.fileName);
						this.currentWorkspace = this.getWorkspaceFromFileUri(event.document.uri);
						this.instanceUrl = this.request.moduleHandler.getModuleUrlFromWorkspacePath(this.currentWorkspace);
						this.completionItemList = await this.completionItemRender();
						//await this.request.getBusinessObjectFields(this.instanceUrl);
					} else {
						this.currentPagePath = undefined;
						this.currentWorkspace = undefined;
						this.instanceUrl = undefined;
					}			
				}
			} catch (e) {
				console.log(e);
			}
			
		})
	}

	async completionItemRender () {
		const objectFieldsList = await this.request.getBusinessObjectFields(this.instanceUrl);
		console.log(objectFieldsList);
		//for ()
		return [new vscode.CompletionItem('log', vscode.CompletionItemKind.Text)];
	}

	getWorkspaceFromFileUri (uri) {
		try {
			const workspace = vscode.workspace.getWorkspaceFolder(uri);
			return crossPlatformPath(workspace.uri.path);
		} catch (e) {
			console.log(e);
		}
	}

	/*getFileNameFromPath (filePath) {
		try {
			const decomposedPath = filePath.split('/');
			return decomposedPath[decomposedPath.length - 1].replace('.java', '');
		} catch (e) {
			console.log(e);
		}
	}*/
}

module.exports = { 
    CompletionHandler: CompletionHandler
}