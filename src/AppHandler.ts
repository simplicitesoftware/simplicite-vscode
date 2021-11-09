/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import simplicite from 'simplicite';
export class AppHandler {
	appList: Map<string, any>;
	constructor() {
		this.appList = new Map(); // Map (url, app), one entry for one instance (ex: one entry = one simplicite instance)
	}
	getApp(moduleURL: string): any {
		if (this.appList.get(moduleURL) === undefined) {
			this.setApp(moduleURL, simplicite.session({ url: moduleURL }));
		}
		return this.appList.get(moduleURL);
	}
	setApp(moduleURL: string, app: any): void {
		this.appList.set(moduleURL, app);
	}
}