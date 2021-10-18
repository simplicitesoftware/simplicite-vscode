'use strict';

import { Uri } from 'vscode';
import { File } from './File';

export interface CustomMessage {
    message: string;
    button: string;
}

export interface ReturnValueOperationsBeforeObjectManipulation {
    fileType: string;
    fileName: string;
    properNameField: string;
}

export interface FieldInfo {
    moduleName: string;
    objectFields: Array<any>;
    instanceUrl: string;
}

export interface ObjectInfo {
    objectType: string,
    field: string,
    icons: {dark: string | Uri, light: string | Uri},
    fieldIcons: {dark: string | Uri, light: string | Uri}
};

export interface FileAndModule {
    moduleName: string,
    instanceUrl: string,
    fileList: File[]
}

export interface OpenFileContext {
    filePath: string,
    fileName: string,
    workspaceUrl: string
}