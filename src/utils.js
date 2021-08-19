'use strict';

const vscode = require('vscode');
const fs = require('fs');

/*const urlToFilename = function (url) {
	let value = url.split('/');
	return value[value.length - 1];
};*/

const findFiles = async function (globPatern) {	
	let foundFile = new Array();
	let files;
	try {
		files = await vscode.workspace.findFiles(globPatern);
	} catch (e) {
		throw(e);
	}
	for (let file of files) {
		try {
			foundFile.push(fs.readFileSync(crossPlatformPath(file.path), 'base64'));
		} catch(err) {
			console.log(err);
		}
	};
	return foundFile[0];
};

const getSimpliciteModules = async function () { // need to change, keeping it in case
	let simpliciteWorspace = new Array();
	try {
		for (let workspaceFolder of vscode.workspace.workspaceFolders) {
			const globPatern = '**/module-info.json';
			const relativePattern = new vscode.RelativePattern(workspaceFolder, globPatern);
			const moduleInfo = await findFiles(relativePattern);
			if (moduleInfo) simpliciteWorspace.push(moduleInfo);
		}
	} catch (err) {
		console.log('No workspace folder has been found yet');
	}
	return simpliciteWorspace;
}

// const verifyScriptBellowing = async function (file, simpliciteWorkspace) { // Will check if script belongs to simplicite module
// 	const globPatern = '**/' + file;
// 	const relativePattern = new vscode.RelativePattern(workspaceFolder, globPatern);
// 	return true;
// }

const crossPlatformPath = function (path) {
	if (path[0] === '/' || path[0] === '\\') path = path.slice(1);
	return path.replaceAll('\\', '/');
}

module.exports = {
    //urlToFilename: urlToFilename,
	findFiles: findFiles, 
	crossPlatformPath: crossPlatformPath,
	getSimpliciteModules: getSimpliciteModules,
}