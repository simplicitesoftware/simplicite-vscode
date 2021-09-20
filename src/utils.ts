'use strict';

export const crossPlatformPath = path => {
    if (process.platform !== 'win32') return path;
    if (path[0] === '/' || path[0] === '\\') path = path.slice(1);
    return path.replaceAll('\\', '/');
}