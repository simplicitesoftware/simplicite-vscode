/* eslint-disable no-var */
'use strict';

import { Uri } from 'vscode';
import { extensionStoragePathMaker } from './utils';

declare global { // has to be declared to asign value globally, these value are not changed during runtime, declared as var instead of const because global is an old boy
	var EXTENSION_ID: string;
	var TEMPLATE: { scheme: string, language: string };
	var SHOW_SIMPLICITE_COMMAND_ID: string;
	var SUPPORTED_FILES: string[];
	var EXCLUDED_FILES: string[];
	var STORAGE_PATH: Uri;
}

export const initGlobalValues = function(storagePath: string): void {
	global.EXTENSION_ID = 'simpliciteSoftware.simplicite-vscode-tools';

	global.TEMPLATE = { scheme: 'file', language: 'java' };
    
	global.SHOW_SIMPLICITE_COMMAND_ID = 'simplicite-vscode-tools.showSimpliciteCommands';

	global.SUPPORTED_FILES = ['.java', '.css', '.less', '.js', '.html', '.md', '.xml', '.txt', '.yaml'];
    
	global.EXCLUDED_FILES = ['BUILD', 'README', 'pom', '.min.', '/Theme/', '/docs/', '/files/', '/target/'];

	global.STORAGE_PATH = extensionStoragePathMaker(storagePath);
};
