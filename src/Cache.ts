'use strict';

export class Cache {
    itemCache: Map<string, number>;
    constructor() {
        this.itemCache = new Map();
    }

    isInCache (fileName: string) {
        this.itemCache.forEach((value, key) => {
            if (key === fileName) {
                return true;
            }
        });
        return false;
    }

    getListFromCache (fileName: string) {
        let returnValue;
        this.itemCache.forEach((value, key) => {
            if (key === fileName) {
                returnValue = value; 
            }
        });
        if (returnValue) return returnValue;
        throw 'Cache has malfunctionned';
    }
    
    addPair (key: string, value: number) {
        this.itemCache.set(key, value);
    }
}