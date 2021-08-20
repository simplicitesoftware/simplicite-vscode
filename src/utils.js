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
			foundFile.push(fs.readFileSync(crossPlatformPath(file.path), { encoding: 'utf8' }));
		} catch(err) {
			console.log(err);
		}
	};
	return foundFile;
};

const getSimpliciteModules = async function () {
	let simpliciteWorspace = new Array();
	try {
		for (let workspaceFolder of vscode.workspace.workspaceFolders) {
			const globPatern = '**/module-info.json';
			const relativePattern = new vscode.RelativePattern(workspaceFolder, globPatern);
			const moduleInfo = await findFiles(relativePattern);
			if (moduleInfo.length >= 2) throw 'More than two modules has been found with the same name';
			const moduleUrl = await getModuleUrl(JSON.parse(moduleInfo[0]).name, workspaceFolder);
			if (moduleInfo) simpliciteWorspace.push({ moduleInfo: JSON.parse(moduleInfo[0]).name, workspaceFolder: workspaceFolder.name, workspaceFolderPath: crossPlatformPath(workspaceFolder.uri.path), moduleUrl: moduleUrl });
		}
	} catch (err) {
		console.log('No workspace folder has been found yet');
	}
	return simpliciteWorspace;
}

const getModuleUrl = async function (moduleName, workspaceFolder) {
	const globPatern = '**pom.xml';
	console.log(globPatern);
	const relativePattern = new vscode.RelativePattern(workspaceFolder, globPatern);
	const pom = await findFiles(relativePattern);
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