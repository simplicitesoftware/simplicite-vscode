'use strict';

export default class AppHandler {
    constructor () {
        this.appList = new Map(); // Map (url, app), one entry for one instance (ex: one entry = one simplicite instance)
    }

    getApp (moduleURL) { 
        if (this.appList.get(moduleURL) === undefined) {
            this.setApp(moduleURL, require('simplicite').session({ url: moduleURL }));
        }
        return this.appList.get(moduleURL);
    }

    setApp (moduleURL, app) {
        this.appList.set(moduleURL, app);
    }

}