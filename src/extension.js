'use strict';

const { window, languages, commands, workspace, ExtensionContext, DocumentSemanticTokensProvider, SemanticTokensBuilder, Position, Range, SemanticTokensLegend } = require('vscode');
const { SimpliciteAPIManager } = require('./SimpliciteAPIManager');
//const { CompletionHandler } = require('./CompletionHandler');

/**
 * @param {ExtensionContext} context
 */
async function activate(context) {
	// Commands has to be declared in package.json so VS Code knows that the extension provides a command
	const loginAllModules = commands.registerCommand('simplicite-vscode.logIn', async () => {	
		await request.loginHandler();
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});

	const applyChanges = commands.registerCommand('simplicite-vscode.applyChanges', async function () {
		try {
			await request.applyChangesHandler();
		} catch (e) {
			console.log(e);
		}
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});

	const logout = commands.registerCommand('simplicite-vscode.logOut', function () {	
		request.logout();
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});

	const connectedInstance = commands.registerCommand('simplicite-connectedInstance', function () {	
		request.connectedInstance();
	});

	const logoutFromModule = commands.registerCommand('simplicite-vscode.logOutFromInstance', async function () {	
		try {
            const moduleName = await window.showInputBox({ 
                placeHolder: 'module name',  
                title: 'Simplicite: Type the name of the module'
            });
            if (!moduleName) throw 'Simplicite: Action canceled';
			await request.specificLogout(moduleName);
        } catch (e) {
            window.showInformationMessage(e.message ? e.message : e);
        }
	});

	const logInInstance = commands.registerCommand('simplicite-vscode.logInInstance', async function () {	
		try {
            const moduleName = await window.showInputBox({ 
                placeHolder: 'module name',  
                title: 'Simplicite: Type the name of the module'
            });
            if (!moduleName) throw 'Simplicite: Action canceled';
			let flag = false;
			for (let module of request.moduleHandler.getModules()) {
				if (module.getName() === moduleName) {
					await request.loginTokenOrCredentials(module);
					flag = true;
				}
			}
			if (!flag) throw `Simplicite: There is no module ${moduleName} in your current workspace`;
        } catch (e) {
            window.showInformationMessage(e.message ? e.message : e);
        }
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});
	const compileWorkspace = commands.registerCommand('simplicite-compileWorkspace', async function () {
		try {
			await request.compileJava();
		} catch (e) {
			console.log(e);
		}
		
	});

	// const tokenTypes = ['class', 'interface', 'enum', 'function', 'variable'];
	// const tokenModifiers = ['declaration', 'documentation'];
	// const legend = new SemanticTokensLegend(tokenTypes, tokenModifiers);
	// const selector = { language: 'java', scheme: 'file' };
	// const provider = {
	// 	provideDocumentSemanticTokens(document) {
	// 		// analyze the document and return semantic tokens
		
	// 		const tokensBuilder = new SemanticTokensBuilder(legend);
	// 		// on line 1, characters 1-5 are a class declaration
	// 		tokensBuilder.push(
	// 		new Range(new Position(1, 1), new Position(1, 5)),
	// 			'class',
	// 			['declaration']
	// 			);
	// 		request.test(tokensBuilder.build());
	// 		return tokensBuilder.build();
	// 	}
	// }
	// languages.registerDocumentSemanticTokensProvider(selector, provider, legend);

	

// 	const tokenTypes = new Map();
// 	const tokenModifiers = new Map();
	
// 	const legend = (function () {
// 		const tokenTypesLegend = [
// 			'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
// 			'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
// 			'method', 'macro', 'variable', 'parameter', 'property', 'label'
// 		];
// 		tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));
	
// 		const tokenModifiersLegend = [
// 			'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
// 			'modification', 'async'
// 		];
// 		tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));
	
// 		return new SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
// 	})();
// 
// 	context.subscriptions.push(languages.registerDocumentSemanticTokensProvider({ language: 'semanticLanguage'}, new CompletionHandler(tokenTypes, tokenModifiers), legend));

	


	context.subscriptions.push(loginAllModules, applyChanges, logout, connectedInstance, logoutFromModule, logInInstance, compileWorkspace); // All commands available
	let request = new SimpliciteAPIManager();
	await request.init(context); // all the asynchronous affectation happens there
	let modulesLength = request.moduleHandler.moduleLength(); // useful to compare module change on onDidChangeWorkspaceFolders

	workspace.onDidSaveTextDocument(async (event) => {
		if (event.uri.path.search('.java') !== -1) {
			await request.fileHandler.setFileList(request.moduleHandler.getModules(), event.uri);
			request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
		}
	})

	request.fileHandler.getModifiedFilesOnStart();

	request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	await request.loginHandler();
	request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	
	workspace.onDidChangeWorkspaceFolders(async (event) => { // The case where one folder is added and one removed should not happen
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
		const tempModules = await request.fileHandler.getSimpliciteModules();
		if (event.added.length > 0 && tempModules.length > modulesLength) { // If a folder is added to workspace and it's a simplicité module
			modulesLength = tempModules.length;
			try {
				await request.loginTokenOrCredentials(request.moduleHandler.getModules()[request.moduleHandler.moduleLength() - 1]); // We need to connect with the module informations
			} catch(e) {
				console.log(e ? e : '');
			}
		} else if (event.removed.length > 0 && tempModules.length < modulesLength) { // in this case, if a folder is removed we check if it's a simplicite module
			await request.specificLogout(event.removed[0].name);
			modulesLength = request.moduleHandler.moduleLength();
		}
		request.moduleHandler.setModules(await this.fileHandler.getSimpliciteModules());
		request.barItem.show(request.fileHandler.fileList, request.moduleHandler.getModules(), request.moduleHandler.getConnectedInstancesUrl());
	});

	
}

module.exports = {
	activate: activate
}
