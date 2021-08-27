'use strict';

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

const getModuleUrlFromName = function (modules, moduleName) {
	for (let module of modules) {
		if (module.moduleInfo === moduleName) {
			return module.moduleUrl;
		}
	}
}

const validURL = function (str) {
	var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
	  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
	  '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
	  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
	  '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
	  '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
	return !!pattern.test(str);
  }

module.exports = {
	isUrlConnected: isUrlConnected,
	isFileInFileList: isFileInFileList,
	getModuleUrlFromName: getModuleUrlFromName,
	validURL: validURL
}