'use strict';

import { logger } from './Log';

export class SimpliciteApiObject {
	app: any;
	constructor(app: any) {
		this.app = app;
	}

	async getModuleInfo (): Promise<any> {
		try {
			return await this.app.getBusinessObject('Module');
		} catch (e: any) {
			logger.error(e);
			return false;
		}
	}

	async getObject (object: string): Promise<any> {
		await this.app.getBusinessObject(object);
	}
}