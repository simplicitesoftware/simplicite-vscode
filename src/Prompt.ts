'use strict';

import { resolve } from 'path';
import { Memento, QuickInputButtons, QuickPickItem, QuickPickItemButtonEvent, ThemeIcon, Uri, window, workspace } from 'vscode';
import { workerData } from 'worker_threads';
import { logger } from './Log';

export class Prompt {
  promptValues: PromptCached;
  private _globalState: Memento;
  constructor(globalState: Memento) {
    this._globalState = globalState;
    this.promptValues = this.getPromptValues();
  }

  getPromptValues(): PromptCached {
    const savedValues: PromptCached | undefined = this._globalState.get('simplicite-prompt-cache')
    return savedValues ? savedValues : new PromptCached();
  }

  savePromptValues() {
    this._globalState.update('simplicite-prompt-cache', this.promptValues);
  }

  
  private getValuesList(attributeName: string) {
    // breaks are shown as useless after the return statement, but they are mandatory for some reason otherwise it returns every case
    switch(attributeName) {
      case 'url':
        return this.promptValues.instanceUrls;
        break;
      case 'apiName':
        return this.promptValues.apiModuleNames;
        break;
      case 'name':
        return this.promptValues.moduleNames;
        break;
      default:
        return [];
    }
  }

  private setValuesList(attributeName: string, values: string[]) {
    switch(attributeName) {
      case 'url':
        this.promptValues.instanceUrls = values;
      case 'apiName':
        this.promptValues.apiModuleNames = values;
      case 'name':
        this.promptValues.moduleNames = values;
    }
    this.savePromptValues();
  }
  /*
  * attributesName values are: 'url', 'apiName', 'name'
  */
  async getUserSelectedValue(attributeName: string, title: string, placeHolder: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const quickPick = window.createQuickPick();
      quickPick.items = this.getValuesList(attributeName).map(choice => ({ label: choice }));
      quickPick.title = title;
      quickPick.placeholder = placeHolder;
  
      quickPick.onDidChangeValue(() => {
        // inject proposed values with current input
        if (!this.getValuesList(attributeName).includes(quickPick.value)) {
          quickPick.items = [quickPick.value, ...this.getValuesList(attributeName)].map(label => ({ label }));
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
        const selection = quickPick.activeItems[0]
        isValidate = true;
        value = selection.label;
        quickPick.hide();
      });
      
      quickPick.onDidHide(() => {
        if(!isValidate) reject(new Error('Simplicité: input cancelled'));
        else resolve(value);
      });

      quickPick.show();
    })
  }

  addElement(attributeName: string, value: string) {
    if (!this.getValuesList(attributeName).includes(value)) {
      this.getValuesList(attributeName).push(value);
      this.savePromptValues();
    } 
  }

  removeElement(attributeName: string, removeValue: string) {
    const newValues: string[] = [];
    for (const value of this.getValuesList(attributeName)) {
      if(value !== removeValue) newValues.push(value);
    }
    this.setValuesList(attributeName, newValues);
  }

  resetValues() {
    this.promptValues = new PromptCached();
    this.savePromptValues();
  }
}

class PromptCached {
	instanceUrls: string[];
	moduleNames: string[];
	apiModuleNames: string[];
  constructor() {
    this.instanceUrls = [];
    this.moduleNames = [];
    this.apiModuleNames = [];
  }
}