'use strict';

// attempt at typing ModuleDevInfo, not implemented yet because it implies many problems
/*export*/class ModuleDevInfo {
  name: string;
	version: number;
	Adapter: Adapter[];
	BPMProcess: BPMProcess[];
	Disposition: Disposition[];
	ObjectExternal: ObjectExternal[];
	ObjectInternal: ObjectInternal[];
	Resource: Resource[];
	Script: Script[];
  constructor(moduleDevInfo: ModuleDevInfo) {
    this.name = moduleDevInfo.name;
    this.version = moduleDevInfo.version;
    this.Adapter = moduleDevInfo.Adapter;
    this.BPMProcess = moduleDevInfo.BPMProcess;
    this.Disposition = moduleDevInfo.Disposition;
    this.ObjectExternal = moduleDevInfo.ObjectExternal;
    this.ObjectInternal = moduleDevInfo.ObjectInternal;
    this.Resource = moduleDevInfo.Resource;
    this.Script = moduleDevInfo.Script;
  }
}

export interface ModuleDevInfoObject {
	classname?: string,
	id: string,
	name: string,
	sourcepath?: string
}

export interface Adapter extends ModuleDevInfoObject {}

export interface BPMProcess extends ModuleDevInfoObject {
	activities: Activity[]
}

export interface Disposition extends ModuleDevInfoObject {}

export interface ObjectExternal extends ModuleDevInfoObject {}

export interface ObjectInternal extends ModuleDevInfoObject {
	actions: Action[],
	publications: Publication[]
	fields: Field[],
	table: string
}

export interface Resource extends ModuleDevInfoObject {
	type: string
}

export interface Script extends ModuleDevInfoObject {}

export interface Publication {
	method: string,
	name: string
}

export interface Field {
	column: string,
	jsonname: string,
	name: string,
	technical: boolean,
	type: string
}

export interface Action {
	method: string,
	name: string
}

export interface Activity {
	name: string,
	type: string
}