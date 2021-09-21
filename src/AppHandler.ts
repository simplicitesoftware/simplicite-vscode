export class AppHandler {
    appList: Map<string, any>;
    constructor () {
        this.appList = new Map(); // Map (url, app), one entry for one instance (ex: one entry = one simplicite instance)
    }

    getApp (moduleURL: string) { 
        if (this.appList.get(moduleURL) === undefined) {
            this.setApp(moduleURL, require('simplicite').session({ url: moduleURL }));
        }
        return this.appList.get(moduleURL);
    }

    setApp (moduleURL: string, app: any) {
        this.appList.set(moduleURL, app);
    }

    getAppList () {
        return this.appList;
    }

    setAppList (appList: Map<string, any>) {
        this.appList = appList;
    }
}