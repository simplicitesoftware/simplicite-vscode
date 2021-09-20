import * as fs from 'fs';
import * as vscode from 'vscode';

const THEIA_NAMES = [ 'Eclipse Theia', 'Theia Multi-Language Example' ]

let dir: string;

if (process.platform === 'win32'){
    dir = process.env.APPDATA + '/Code/User/simplicite/';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
} else if (THEIA_NAMES.includes(vscode.env.appName)) {
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

const TOKEN_SAVE_PATH = dir + 'simplicite-info.json';
const FILES_SAVE_PATH = dir + 'simplicite-files.json';
const LOGS_PATH = dir + 'simplicite.logs';
const EXTENSION_ID = 'simpliciteExtensionTest.simplicite-vscode';

export {
    TOKEN_SAVE_PATH,
    FILES_SAVE_PATH,
    EXTENSION_ID,
    LOGS_PATH
};