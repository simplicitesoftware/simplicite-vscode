'use strict';

const vscode = require('vscode');
const { crossPlatformPath } = require('./utils');

const triggerFunctions = ['getField', 'getFieldValue', 'setFieldValue'];

class CompletionHandler {
    constructor (request) {
		this.request = request;
        this.template = { scheme: 'file', language: 'java' };
		this.currentPagePath = crossPlatformPath(vscode.window.activeTextEditor.document.uri.path);
		this.currentWorkspace = this.getWorkspaceFromFileUri(vscode.window.activeTextEditor.document.uri);
		this.instanceUrl = this.request.moduleHandler.getModuleUrlFromWorkspacePath(this.currentWorkspace);
		this.completionItemList = this.request.getBusinessObjectFields(this.currentPagePath, this.instanceUrl);
		this.activeEditorListener();	
    }

    provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        if (linePrefix === -1) {
          return []
        }
		let myitem = (text) => {
			let item = new vscode.CompletionItem(text, vscode.CompletionItemKind.Text);
			item.range = new vscode.Range(position, position);
			return item;
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
    }

	activeEditorListener () {
		const listener = vscode.window.onDidChangeActiveTextEditor(event => {
			if (event !== undefined) {
				if (event.document.uri.path.includes('.java')) {
					this.currentPagePath = crossPlatformPath(event.document.fileName);
					this.currentWorkspace = this.getWorkspaceFromFileUri(event.document.uri);
					this.instanceUrl = this.request.moduleHandler.getModuleUrlFromWorkspacePath(this.currentWorkspace);
					this.completionItemList = this.request.getBusinessObjectFields(this.currentPagePath, this.instanceUrl);
				} else {
					this.currentPagePath = undefined;
					this.currentWorkspace = undefined;
					this.instanceUrl = undefined;
				}			
			}
		})
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