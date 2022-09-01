'use strict';

import { window, MarkdownString, StatusBarItem, env } from 'vscode';
import { SimpliciteInstance } from './SimpliciteInstance';

export class BarItem {
	barItem: StatusBarItem;
	constructor() {
		this.barItem = window.createStatusBarItem(2);
		this.barItem.text = 'Simplicite';
		this.barItem.command = 'simplicite-vscode-tools.showSimpliciteCommands'; // open quick pick on click
	}

	// refresh the BarItem
	show(instances: SimpliciteInstance[]): void {
    const {connectedInstances, disconnectedInstances} = this.sortInstances(instances);
		if (instances.length === 0) {
			this.barItem.tooltip = 'No Simplicite instance in workspace';
			return;
		}
		if (env.appHost !== 'desktop') {
      if(connectedInstances.length > 0) this.barItem.tooltip = 'Connected instance(s): ';
      connectedInstances.forEach((instance, index) => {
        this.barItem.tooltip += instance.app.parameters.url;
        if(index !== connectedInstances.length - 1) this.barItem.tooltip += ', ';
      })
      if(disconnectedInstances.length > 0) this.barItem.tooltip = 'Disconnected instance(s): ';
      disconnectedInstances.forEach((instance, index) => {
        this.barItem.tooltip += instance.app.parameters.url;
        if(index !== disconnectedInstances.length - 1) this.barItem.tooltip += ', ';
      })      
		} else {
			this.barItem.tooltip = new MarkdownString(this.markdownGenerator(connectedInstances, disconnectedInstances));
		}
		this.barItem.show();
	}

  private sortInstances(instances: SimpliciteInstance[]) {
    const connectedInstances: SimpliciteInstance[] = [];
    const disconnectedInstances: SimpliciteInstance[] = [];
    instances.forEach((instance) => {
      if(instance.app.token) connectedInstances.push(instance);
      else disconnectedInstances.push(instance);
    })
    return {connectedInstances, disconnectedInstances};
  }

	private markdownGenerator(connectedInstances: SimpliciteInstance[], disconnectedInstances: SimpliciteInstance[]) {
		return this.mkConnectedInstances(connectedInstances) + this.mkDisconnectedInstances(disconnectedInstances);
	}

	// creates the markdown of the connected instances and their modules
	private mkConnectedInstances(connected: SimpliciteInstance[]): string {
		let moduleMarkdown = '';
		if (connected.length > 0) {
			moduleMarkdown = 'Connected Simplicite\'s instances:\n\n';
			for (const instance of connected) {
				moduleMarkdown += instance.app.parameters.url + ':\n';
				instance.modules.forEach((mod) => {
          moduleMarkdown += '- ';
          moduleMarkdown += mod.name + '\n\n';
        })
			}
			moduleMarkdown += '\n\n---\n\n';
		}
		return moduleMarkdown;
	}

	// same for disconnected instances and their modules
	private mkDisconnectedInstances(disconnected: SimpliciteInstance[]): string {
		let moduleMarkdown = '';
		if (disconnected.length > 0) {
			moduleMarkdown += 'Disconnected Simplicite\'s instances:\n\n';
			for (const instance of disconnected) {			
        moduleMarkdown += instance.app.parameters.url + ':\n';
        instance.modules.forEach((mod) => {
          moduleMarkdown += '- ';
          moduleMarkdown += mod.name + '\n\n';
        });
			}
		}
		return moduleMarkdown;
	}
}