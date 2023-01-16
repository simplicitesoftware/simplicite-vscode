'use strict';

import { Memento, Uri, window } from 'vscode';
import { CustomFile } from './CustomFile';
import { ConflictAction } from './interfaces';
const MD5 = require('md5.js');

export class HashService {
    
    public static async saveFilesHash(instance: string, module: string, files: CustomFile[], globalState: Memento) {
        const filesHash: FileHash[] = [];
        for(const file of files) {
            filesHash.push({path: file.uri.path, hash: await HashService.computeFileHash(file.uri)});
        }
        globalState.update(HashService.getStateId(instance, module), filesHash);
    }

    public static async updateFileHash(instance: string, module: string, uri: Uri, globalState: Memento) {
        const stateId = HashService.getStateId(instance, module);
        const filesHash: FileHash[] = globalState.get(stateId, []);
        const fileIndex = filesHash.findIndex((fileHash) => fileHash.path === uri.path);
        if(fileIndex === -1) {
            console.error('File does not exist, cannot update hash');
            return null;
        }
        filesHash[fileIndex].hash = await this.computeFileHash(uri);
        globalState.update(stateId, filesHash);
    }

    private static getFileHash(instance: string, module: string, uri: Uri, globalState: Memento) {
        const stateId = HashService.getStateId(instance, module);
        const filesHash: FileHash[] = globalState.get(stateId, []);
        const fileIndex = filesHash.findIndex((fileHash) => fileHash.path === uri.path);
        if(fileIndex === -1) {
            console.error('File does not exist, cannot update hash');
            return null;
        }
        return filesHash[fileIndex].hash;
    }

    // returns true if there is a conflict, otherwise returns false
    public static async checkForConflict(file: CustomFile, instance: string, module: string, globalState: Memento): Promise<ConflictReturn> {
        
        const localHash = HashService.getFileHash(instance, module, file.uri, globalState);
        const currentHash = await HashService.computeFileHash(file.uri);
        const remoteContent = await file.getRemoteFileContent();
        if (!remoteContent) {
            console.warn('Cannot compare local file content with remote content');
            return {action: ConflictAction.sendFile, remoteContent: null};
        }
        const remoteHash = new MD5().update(remoteContent.toString()).digest('hex');
        if(localHash === currentHash && localHash !== remoteHash) {
            const msg = 'No local changes detected, but remote is different, fetching remote version, ' + file.name;
            console.log(msg);
            window.showInformationMessage(msg);
            return {action: ConflictAction.fetchRemote, remoteContent: remoteContent};
        } else if(localHash !== currentHash && localHash !== remoteHash) {
            console.log('Local changes have been made and remote content differs, opening conflict editor');
            return {action: ConflictAction.conflict, remoteContent: remoteContent};
        } else if(localHash === currentHash && currentHash === remoteHash) {
            return {action: ConflictAction.nothing, remoteContent: null};
        }
        return {action: ConflictAction.sendFile, remoteContent: null};
    }

    private static async computeFileHash(uri: Uri): Promise<string> {
        const content = (await CustomFile.getContent(uri));
        const hash = new MD5().update(content.toString()).digest('hex');
        return hash;
    }

    private static getStateId(instance: string, module: string) {
        return `simplicite_${instance}_${module}`;
    }
}

interface FileHash {
    path: string,
    hash: string
}

interface ConflictReturn {
    action: ConflictAction,
    remoteContent: Uint8Array | null
}