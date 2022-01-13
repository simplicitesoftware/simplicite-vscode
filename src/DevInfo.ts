'use strict';

export class DevInfo {
  dependencies: {artifact: string, group: string, version: string}[];
	javadoc: string;
	jvm: {minimal: number, recommended: number, version: number};
	objects: DevInfoObject[];
	version: string;
  constructor(devInfo: DevInfo) {
    this.dependencies = devInfo.dependencies;
    this.javadoc = devInfo.javadoc;
    this.jvm = devInfo.jvm;
    this.objects = devInfo.objects;
    this.version = devInfo.version;
  }

	getSourceField(type: string) {
		for (const obj of this.objects) {
			if (obj.object === type) return obj.sourcefield;
		}
		return '';
	}
}

export interface DevInfoObject {
	classnamefield?: string
	completion?: Completion,
	icon: string,
	keyfield: string,
	object: string,
	package?: string,
	sourcefield: string
}

export interface Completion {
	activities: string[],
	actions: string[],
	fields: string[],
	publications: string[]
}