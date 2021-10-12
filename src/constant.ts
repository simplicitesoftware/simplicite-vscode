'use strict';

import * as fs from 'fs';
import * as vscode from 'vscode';
import { crossPlatformPath } from './utils';
import * as path from 'path';

const THEIA_NAMES = [ 'Eclipse Theia', 'Theia Multi-Language Example' ];

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

export const TOKEN_SAVE_PATH = crossPlatformPath(dir + 'simplicite-info.json');
export const FILES_SAVE_PATH = crossPlatformPath(dir + 'simplicite-files.json');
export const LOGS_PATH = crossPlatformPath(dir + 'simplicite.logs');
export const EXTENSION_ID = 'simpliciteSoftware.simplicite-vscode-tools';

export const objectInfo = [
    {
        objectType: 'BPMProcess',
        field: 'activities',
        icons: {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'bpm.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'bpm.svg')
        },
        fieldIcons: {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'activity.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'activity.svg')
        },
        functions: ['getAction'],
    },
    {
        objectType: 'ObjectExternal',
        field: 'actions',
        icons: {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'external.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'external.svg')
        },
        fieldIcons: {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'action.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'action.svg')
        },
        functions: ['getField', 'getFieldValue', 'setFieldValue'],
    },
    {
        objectType: 'ObjectInternal',
        field: 'fields',
        icons: {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'object.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'object.svg')
        },
        fieldIcons: {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'field.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'field.svg')
        },
        functions: ['getField', 'getFieldValue', 'setFieldValue'],
    },
    {
        objectType: 'Script',
        field: '',
        icons: {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'script.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'script.svg')
        },
        fieldIcons: {
            light: '',
            dark: ''
        },
        functions: []
    },
    {
        objectType: 'Adapter',
        field: '',
        icons: {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'adapter.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'adapter.svg')
        },
        fieldIcons: {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'script.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'script.svg')
        },
        functions: []
    },
    {
        objectType: 'Disposition',
        field: '',
        icons: {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'adapter.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'adapter.svg')
        },
        fieldIcons: {
            light: '',
            dark: ''
        },
        functions: []
    }    
];