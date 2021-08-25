'use strict';

const vscode = require('vscode');
const fs = require('fs');
var parseString = require('xml2js').parseStringPromise;

const crossPlatformPath = function (path) {
	if (path[0] === '/' || path[0] === '\\') path = path.slice(1);
	return path.replaceAll('\\', '/');
}

const JSON_SAVE_PATH = crossPlatformPath(require('./constant').JSON_SAVE_PATH);

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
			foundFile.push(fs.readFileSync(crossPlatformPath(file.path), { encoding: 'utf-8' }));
		} catch(err) {
			console.log(err);
		}
	};
	return foundFile;
};

const getSimpliciteModules = async function () { // returns the list of the folders detected as simplicite modules
	let simpliciteWorkspace = new Array();
	try {
		for (let workspaceFolder of vscode.workspace.workspaceFolders) {
			const globPatern = '**/module-info.json'; // if it contains module-info.json -> simplicite module
			const relativePattern = new vscode.RelativePattern(workspaceFolder, globPatern);
			const moduleInfo = await findFiles(relativePattern);
			if (moduleInfo.length >= 2) throw 'More than two modules has been found with the same name';
			const moduleUrl = await getModuleUrl(workspaceFolder);
			if (moduleInfo) simpliciteWorkspace.push({ moduleInfo: JSON.parse(moduleInfo[0]).name, workspaceFolder: workspaceFolder.name, workspaceFolderPath: crossPlatformPath(workspaceFolder.uri.path), moduleUrl: moduleUrl, isConnected: false });
		}
		const token = fs.readFileSync(JSON_SAVE_PATH, 'utf-8'); // get the connexion status
		const infoJSON = JSON.parse(token);
		for (let info of infoJSON) {
			for (let workspace of simpliciteWorkspace) {
				if (info.moduleInfo === workspace.moduleInfo) {
					workspace.isConnected = info.isConnected;
				}
			}
		}
	} catch (err) {
		console.log(err);
	}
	return simpliciteWorkspace;
}

const getModuleUrl = function (workspaceFolder) { // searches into pom.xml and returns the simplicite's instance url
	return new Promise(async function(resolve, reject) {
		const globPatern = '**pom.xml';
		const relativePattern = new vscode.RelativePattern(workspaceFolder, globPatern);
		const pom = await findFiles(relativePattern);
		parseString(pom).then(res => {
			resolve(res.project.properties[0]['simplicite.url'][0]);
		}).catch(e => {
			reject(e);
		});
	})
}

const isUrlConnected = function (url, map) {
	map.forEach(connectedUrl => {
		if (connectedUrl === url) return true
	});
	return false;
}

const isFileInFileList = function (fileList, filePath) {
	for (let fileListelement of fileList) {
		if (fileListelement.filePath === filePath) return true; 
	}
	return false;
}

module.exports = {
    //urlToFilename: urlToFilename,
	findFiles: findFiles, 
	crossPlatformPath: crossPlatformPath,
	getSimpliciteModules: getSimpliciteModules,
	isUrlConnected: isUrlConnected,
	isFileInFileList: isFileInFileList
}