let TOKEN_SAVE_PATH;
let FILES_SAVE_PATH;

if (process.platform === 'win32'){
    TOKEN_SAVE_PATH = process.env.APPDATA + '/Code/User/globalStorage/simplicite-info.json';
    FILES_SAVE_PATH = process.env.APPDATA + '/Code/User/globalStorage/simplicite-files.json';
} else {
    TOKEN_SAVE_PATH = process.env.HOME + '/.vscode/extensions/simplicite-info.json';
    FILES_SAVE_PATH = process.env.HOME + '/.vscode/extensions/simplicite-files.json';
} 

module.exports = {
    TOKEN_SAVE_PATH: TOKEN_SAVE_PATH,
    FILES_SAVE_PATH: FILES_SAVE_PATH
}