'use strict';

export function crossPlatformPath (path: string): string {
    if (process.platform !== 'win32') {
        return path;
    }
    if (path[0] === '/' || path[0] === '\\') {
        path = path.slice(1);
    }
    return replaceAll(path, '\\\\', '/');
};

export function replaceAll(str: string, find: string, replace: string): string {
    const value = str.replace(new RegExp(find, 'g'), replace);
    return str.replace(new RegExp(find, 'g'), replace);
}