const fs = require('fs');

let TOKEN_SAVE_PATH;
let FILES_SAVE_PATH;

if (process.platform === 'win32'){
    const dir = process.env.APPDATA + '/Code/User/';
    if (!fs.existsSync(dir + 'simplicite/')) {
        fs.mkdirSync(dir + 'simplicite/');
    }
    TOKEN_SAVE_PATH = dir + 'simplicite/simplicite-info.json';
    FILES_SAVE_PATH = dir + 'simplicite/simplicite-files.json';
} else {
    const dir = process.env.HOME + '/.config/Code/User/';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    TOKEN_SAVE_PATH = dir + 'simplicite/simplicite-info.json';
    FILES_SAVE_PATH = dir + 'simplicite/simplicite-files.json';
} 

const EXTENSION_ID = 'simpliciteExtensionTest.simplicite-vscode';

module.exports = {
    TOKEN_SAVE_PATH: TOKEN_SAVE_PATH,
    FILES_SAVE_PATH: FILES_SAVE_PATH,
    EXTENSION_ID: EXTENSION_ID,
}