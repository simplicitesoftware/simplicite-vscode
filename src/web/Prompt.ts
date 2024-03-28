'use strict';

import { Memento, QuickPickItem, ThemeIcon, window } from 'vscode';

export class Prompt {
	instances: Map<string, Instance>;
	private _globalState: Memento;
	constructor(globalState: Memento) {
		this._globalState = globalState;
		this.instances = this.getPromptValues();
	}
	
	getPromptValues(): Map<string, Instance> {
		const savedValues: Object | undefined = this._globalState.get(PROMPT_CACHE);
		if(savedValues) return new Map(Object.entries(savedValues));
		return new Map();
	}
	
	async savePromptValues() {
		await this._globalState.update(PROMPT_CACHE, Object.fromEntries(this.instances));
	}
	
	private getValuesList(attributeName: string, instanceUrl?: string): PromptItem[] {
		// breaks are shown as useless after the return statement, but they are mandatory for some reason otherwise it returns every case
		const quickPickItems: PromptItem[] = [];
		switch(attributeName) {
		case 'url':
			if(this.instances) {
				this.instances.forEach((_inst, key) => quickPickItems.push(new PromptItem(key)));
				return quickPickItems;
			} else {
				return [];
			}
			break;
		case 'name':
			if(instanceUrl) {
				const instance = this.instances.get(instanceUrl);
				if(instance) {
					instance.modules.forEach((modName) => quickPickItems.push(new PromptItem(modName)));
					return quickPickItems;
				}
			}
			return quickPickItems;
			break;
		default:
			return quickPickItems;
		}
		return quickPickItems;
	}
	
	private async setValuesList(_attributeName: string, _values: string[]) {
		//switch(attributeName) {
		// case 'url':
		// 	this.promptValues.instances = values;
		// 	break;
		// case 'apiName':
		// 	this.promptValues.apiModuleNames = values;
		// 	break;
		// case 'name':
		// 	this.promptValues.moduleNames = values;
		// 	break;
		// }
		await this.savePromptValues();
	}
	/*
	* attributesName values are: 'url', 'apiName', 'name'
	*/
	async getUserSelectedValue(attributeName: string, title: string, placeHolder: string, instanceUrl?: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const quickPick = window.createQuickPick<PromptItem>();
			quickPick.items = this.getValuesList(attributeName, instanceUrl);
			quickPick.title = title;
			quickPick.placeholder = placeHolder;
			
			quickPick.onDidChangeValue(() => {
				// inject proposed values with current input
				if (!this.getValuesList(attributeName, instanceUrl).filter((item) => item.label.includes(quickPick.value))) {
					quickPick.items = [new PromptItem(quickPick.value) , ...this.getValuesList(attributeName, instanceUrl)];
				}
				// remove item where label === '' so it won't show a void item
				const cleanItems = [];
				for (const item of quickPick.items) {
					if (item.label !== '') cleanItems.push(item);
				}
				quickPick.items = cleanItems;
			});
			
			// usefull to differenciate onDidHide from validation or cancellation
			let isValidate = false;
			let value = '';
			quickPick.onDidAccept(() => {
				isValidate = true;
				if(quickPick.selectedItems.length > 0) {
					value = quickPick.selectedItems[0].label;
				} else if(quickPick.value !==  '') {
					value = quickPick.value;
				} else {
					console.warn('Prompt error: no value has been found');
				}
				quickPick.hide();
			});
			
			quickPick.onDidHide(() => {
				if(!isValidate) reject(new Error('Simplicité: input cancelled'));
				else resolve(value);
			});
			
			quickPick.show();
		});
	}
	
	async addElement(attributeName: string, value: string, instanceUrl?: string) {
		if(attributeName === 'url') {
			if(!this.instances.has(value)) this.instances.set(value, {modules: []});
		} else if (attributeName === 'name' && instanceUrl) {
			const instance = this.instances.get(instanceUrl);
			if(instance && !instance.modules.includes(value)) {
				instance.modules.push(value);
			}
		}
		await this.savePromptValues();
	}
	
	removeElement(attributeName: string, removeValue: string) {
		const newValues: string[] = [];
		for (const value of this.getValuesList(attributeName)) {
			if(value.label !== removeValue) newValues.push(value.label);
		}
		this.setValuesList(attributeName, newValues);
	}
	
	resetValues() {
		this.instances = new Map();
		this._globalState.update(PROMPT_CACHE, undefined);
	}

	async simpleInput(title: string, placeHolder: string, isPassword: boolean | void) {
		const input = await window.showInputBox({
			placeHolder: placeHolder,
			title: title,
			password: isPassword ? isPassword : false
		});
		if (!input) throw new Error('Simplicité: input cancelled');
		return input;
	}
}

interface Instance {
	modules: string[]
}

export enum PromptValue {
	url = 'url',
	apiName = 'apiName',
	name = 'name'
}

class PromptItem implements QuickPickItem {

	label: string;
	constructor(label: string) {
		this.label = label;
	}
}