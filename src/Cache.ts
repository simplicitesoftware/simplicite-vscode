'use strict';

export class Cache {
    private _itemCache: Map<string, number>;
    constructor() {
        this._itemCache = new Map();
    }

    isInCache (fileName: string) {
        this._itemCache.forEach((value, key) => {
            if (key === fileName) {
                return true;
            }
        });
        return false;
    }

    getListFromCache (fileName: string) {
        let returnValue;
        this._itemCache.forEach((value, key) => {
            if (key === fileName) {
                returnValue = value; 
            }
        });
        if (returnValue) {
            return returnValue;
        }
        throw new Error('Cache has malfunctionned');
    }
    
    addPair (key: string, value: number) {
        this._itemCache.set(key, value);
    }
}