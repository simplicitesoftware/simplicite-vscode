'use strict';

import { env, FileSystem } from 'vscode';
import { crossPlatformPath } from './utils';
import * as path from 'path';

const THEIA_NAMES = [ 'Eclipse Theia', 'Theia Multi-Language Example' ];

let dir: string;

/*
if (process.platform === 'win32'){
    dir = process.env.APPDATA + '/Code/User/simplicite/';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
} else if (THEIA_NAMES.includes(env.appName)) {
    dir = process.env.HOME + '/plugins/vscode-simplicite/';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
} else {
    dir = process.env.HOME + '/.config/Code/User/simplicite/';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

export const TOKEN_SAVE_PATH = crossPlatformPath(dir + 'simplicite-info.json');
export const FILES_SAVE_PATH = crossPlatformPath(dir + 'simplicite-files.json');
export const LOGS_PATH = crossPlatformPath(dir + 'simplicite.logs');
*/
export const EXTENSION_ID = 'simpliciteSoftware.simplicite-vscode-tools';

export const template =  { scheme: 'file', language: 'java' };

export const supportedFiles = ['.java', '.css', '.less', '.js', '.html', '.md', '.xml', '.txt', '.yaml'];
