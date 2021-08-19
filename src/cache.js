'use strict';

class Cache {
    constructor() {
        this.itemCache = new Map();
    }

    isInCache (fileName) {
        this.itemCache.forEach((value, key) => {
            if (key === fileName) {
                return true;
            }
        });
        return false;
    }

    getListFromCache (fileName) {
        let returnValue;
        this.itemCache.forEach((value, key) => {
            console.log(value, key, fileName);
            if (key === fileName) {
                returnValue = value; 
            }
        });
        if (returnValue) return returnValue;
        throw 'Cache has malfunctionned';
    }
    
    addPair (key, value) {
        this.itemCache.set(key, value);
    }
}

module.exports = {
    Cache: Cache
}