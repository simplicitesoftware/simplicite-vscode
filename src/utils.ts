'use strict';

export function crossPlatformPath (path: string): string {
    /*if (process.platform !== 'win32') {
        return path;
    }*/
    if (path[0] === '/' || path[0] === '\\') {
        path = path.slice(1);
    }
    return replaceAll(path, '\\\\', '/');
};

export function replaceAll(str: string, find: string, replace: string): string {
    return str.replace(new RegExp(find, 'g'), replace);
}

const supportedFiles = ['.java', '.css', '.less', '.js', '.html', '.md', '.xml'];
const excludedFiles = ['BUILD', 'README', 'pom', '.min.', '/Theme/', '/docs/', '/files/'];

export function validFileExtension (template: string): boolean {
    for (let extension of supportedFiles) {
        if (template.includes(extension) && checkExclude(template)) {
            return true;
        }
    }
    return false;
}

function checkExclude (template: string): boolean {
    for (let exclude of excludedFiles) {
        const result = template.includes(exclude);
        if (template.includes(exclude)) {
            return false;
        }
    }
    return true;
}

export function removeFileExtension (template: string): string {
    let fileName = template;
    for (let valid of supportedFiles) {
        const beforeLegnth = fileName.length;
        fileName = template.replace(valid, '');
        if (beforeLegnth > fileName.length) {
            break;
        }
    }
    return fileName;
}