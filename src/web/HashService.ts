'use strict';

import { Memento, Uri } from 'vscode';
import { File } from './File';
import { logger } from './log';
const MD5 = require('md5.js');

export class HashService {
    
    public static async saveFilesHash(instance: string, module: string, files: File[], globalState: Memento) {
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
            logger.error('File does not exist, cannot update hash');
            return null;
        }
        filesHash[fileIndex].hash = await this.computeFileHash(uri);
        globalState.update(stateId, filesHash);
    }

    // returns true if files hash are the same, otherwise returns false
    public static async compareFilesHash() {

    }

    private static async computeFileHash(uri: Uri): Promise<string> {
        const content = (await File.getContent(uri)).toString();
        const hash = new MD5().update(content).digest('hex');
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