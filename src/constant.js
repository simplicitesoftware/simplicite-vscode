let JSON_SAVE_PATH;
if (process.platform === 'win32'){
    JSON_SAVE_PATH = process.env.APPDATA + '/Code/User/globalStorage/simplicite-info.json';
} else {
    JSON_SAVE_PATH = '/home/.vscode/simplicite-info.json';
} 

module.exports = {
    JSON_SAVE_PATH: JSON_SAVE_PATH
}