const fs = require('fs');
const vscode = require('vscode');

const THEIA_NAMES = [ 'Eclipse Theia', 'Theia Multi-Language Example' ]

let TOKEN_SAVE_PATH;
let FILES_SAVE_PATH;
let LOGS_PATH;



if (process.platform === 'win32'){
    const dir = process.env.APPDATA + '/Code/User/';
    if (!fs.existsSync(dir + 'simplicite/')) {
        fs.mkdirSync(dir + 'simplicite/');
    }
    TOKEN_SAVE_PATH = dir + 'simplicite/simplicite-info.json';
    FILES_SAVE_PATH = dir + 'simplicite/simplicite-files.json';
    LOGS_PATH = dir + 'simplicite/simplicite.logs';
} else if (THEIA_NAMES.includes(vscode.env.appName)) {
    const dir = process.env.HOME + '/plugins/vscode-simplicite/';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    TOKEN_SAVE_PATH = dir + 'simplicite-info.json';
    FILES_SAVE_PATH = dir + 'simplicite-files.json';
    LOGS_PATH = dir + 'simplicite.logs';
} else {
    const dir = process.env.HOME + '/.config/Code/User/';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    TOKEN_SAVE_PATH = dir + 'simplicite/simplicite-info.json';
    FILES_SAVE_PATH = dir + 'simplicite/simplicite-files.json';
    LOGS_PATH = dir + 'simplicite/simplicite.logs';
}

const EXTENSION_ID = 'simpliciteExtensionTest.simplicite-vscode';

module.exports = {
    TOKEN_SAVE_PATH: TOKEN_SAVE_PATH,
    FILES_SAVE_PATH: FILES_SAVE_PATH,
    EXTENSION_ID: EXTENSION_ID,
    LOGS_PATH: LOGS_PATH
}