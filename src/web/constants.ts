/* eslint-disable no-var */
'use strict';

declare global { // has to be declared to asign value globally, these value are not changed during runtime, declared as var instead of const because global is an old boy
	var EXTENSION_ID: string;
	var TEMPLATE: { scheme: string, language: string };
	var SHOW_SIMPLICITE_COMMAND_ID: string;
	var SUPPORTED_FILES: string[];
	var EXCLUDED_FILES: string[];
	var STORAGE_PATH: string;
	var AUTHENTICATION_STORAGE: string;
	var FILES_STATUS_STORAGE: string;
	var API_MODULES: string;
	var PROMPT_CACHE: string;
	var API_MODULE_ADDED_IN_EMPTY_WK: string;
}

export const initGlobalValues = function(storagePath: string): void {
	global.EXTENSION_ID = 'simpliciteSoftware.simplicite-vscode-tools';

	global.TEMPLATE = { scheme: 'file', language: 'java' };
    
	global.SHOW_SIMPLICITE_COMMAND_ID = 'simplicite-vscode-tools.showSimpliciteCommands';

	global.SUPPORTED_FILES = ['.java', '.css', '.less', '.js', '.html', '.md', '.xml', '.txt', '.yaml'];
    
	global.EXCLUDED_FILES = ['BUILD', 'README', '.xml', '.min.', '/Theme/', '/docs/', '/files/', '/target/', '.json']; // todo

	global.STORAGE_PATH = storagePath + '/';

	global.AUTHENTICATION_STORAGE = 'simplicite_authentication';

	global.FILES_STATUS_STORAGE = 'simplicite_files';
	
	global.API_MODULES = 'simplicite_api_modules';

	global.PROMPT_CACHE = 'simplicite-prompt-cache';

	global.API_MODULE_ADDED_IN_EMPTY_WK = 'simplicite_handle_special_api_module';
};
