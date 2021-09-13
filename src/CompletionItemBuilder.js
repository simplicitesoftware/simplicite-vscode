'use strict';

const vscode = require('vscode');

class CompletionItemBuilder {
    constructor () {
        this.template = { scheme: 'file', language: 'java' };
    }

    provideCompletionItems(document, position, _token) {
        const line = document.lineAt(position.line)
        const dotIdx = line.text.lastIndexOf('.', position.character)
    
        console.log(dotIdx);

        if (dotIdx === -1) {
          return []
        }
    }

      
}

module.exports = { 
    CompletionItemBuilder: CompletionItemBuilder
}