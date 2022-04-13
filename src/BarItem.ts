'use strict';

import { window, MarkdownString, StatusBarItem, env } from 'vscode';
import { ApiModule } from './ApiModule';
import { Module } from './Module';

export class BarItem {
	barItem: StatusBarItem;
	constructor() {
		this.barItem = window.createStatusBarItem(2);
		this.barItem.text = 'Simplicite';
		this.barItem.command = 'simplicite-vscode-tools.showSimpliciteCommands'; // open quick pick on click
	}

	// refresh the BarItem
	show(modules: Array<Module | ApiModule>, connectedInstances: string[]): void {
		if (modules.length === 0 && connectedInstances.length === 0) {
			this.barItem.tooltip = 'No Simplicite module connected';
			return;
		}
		if (env.appHost !== 'desktop') {
			if (connectedInstances.length === 0) {
				this.barItem.tooltip = 'No module connected';
			} else {
				this.barItem.tooltip = 'Connected modules: ';
				let cpt = 0;
				for (const instance of connectedInstances) {
					this.barItem.tooltip += instance;
					if (cpt !== connectedInstances.length - 1) {
						this.barItem.tooltip += ', ';
						cpt++;
					}
				}
			}
		} else {
			this.barItem.tooltip = new MarkdownString(this.markdownGenerator(modules, connectedInstances));
		}
		this.barItem.show();
	}

	private markdownGenerator(modules: Array<Module>, connectedInstances: Array<string>) {
		return this.connectedInstancesAndModules(modules, connectedInstances) + this.disconnectedInstancesAndModules(modules, connectedInstances);
	}

	// creates the markdown of the connected instances and their modules
	private connectedInstancesAndModules(modules: Array<Module>, connectedInstances: Array<string>): string {
		let moduleMarkdown = '';
		if (connectedInstances.length > 0) {
			moduleMarkdown = 'Connected Simplicite\'s instances:\n\n';
			for (const url of connectedInstances) {
				moduleMarkdown += url + ':\n';
				for (const module of modules) {
					if (url === module.instanceUrl) {
						moduleMarkdown += '- ';
						moduleMarkdown += module.name + '\n\n';
					}
				}
			}
			moduleMarkdown += '\n\n---\n\n';
		}
		return moduleMarkdown;
	}

	// same for disconnected instances / modules
	private disconnectedInstancesAndModules(modules: Array<Module>, connectedInstances: Array<string>): string {
		let moduleMarkdown = '';
		let disconnectedModule = false;
		if (modules.length > 0) {
			moduleMarkdown += 'Disconnected modules:\n\n';
			for (const module of modules) {
				if (!connectedInstances.includes(module.instanceUrl)) {
					moduleMarkdown += '- ' + module.name + '\n\n';
					disconnectedModule = true;
				}
			}
			if (!disconnectedModule) {
				return '';
			}
		}
		return moduleMarkdown;
	}
}