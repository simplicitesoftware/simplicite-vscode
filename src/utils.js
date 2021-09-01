'use strict';

const isUrlConnected = function (url, map) {
	map.forEach(connectedUrl => {
		if (connectedUrl === url) return true
	});
	return false;
}

const getModuleUrlFromName = function (modules, moduleName) {
	for (let module of modules) {
		if (module.moduleInfo === moduleName) {
			return module.moduleUrl;
		}
	}
}

module.exports = {
	isUrlConnected: isUrlConnected,
	getModuleUrlFromName: getModuleUrlFromName
}