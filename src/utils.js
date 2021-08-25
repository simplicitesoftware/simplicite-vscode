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

module.exports = {
	isUrlConnected: isUrlConnected,
	isFileInFileList: isFileInFileList
}