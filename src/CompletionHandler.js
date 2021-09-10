'use strict';

const vscode = require('vscode');



class CompletionHandler {
    constructor (tokenTypes, tokenModifiers) {
        this.tokenTypes = tokenTypes;
        this.tokenModifiers = tokenModifiers
    }

    async provideDocumentSemanticTokens(document) {
		const allTokens = this._parseText(document.getText());
		const builder = new vscode.SemanticTokensBuilder();
		allTokens.forEach((token) => {
			builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), this._encodeTokenModifiers(token.tokenModifiers));
		});
        
		return builder.build();
	}

    _encodeTokenType(tokenType) {
		if (this.tokenTypes.has(tokenType)) {
			return this.tokenTypes.get(tokenType);
		} else if (tokenType === 'notInLegend') {
			return this.tokenTypes.size + 2;
		}
		return 0;
	}

	_encodeTokenModifiers(strTokenModifiers) {
		let result = 0;
		for (let i = 0; i < strTokenModifiers.length; i++) {
			const tokenModifier = strTokenModifiers[i];
			if (this.tokenModifiers.has(tokenModifier)) {
				result = result | (1 << this.tokenModifiers.get(tokenModifier));
			} else if (tokenModifier === 'notInLegend') {
				result = result | (1 << this.tokenModifiers.size + 2);
			}
		}
		return result;
	}

	_parseText(text) {
		const r = [];
		const lines = text.split(/\r\n|\r|\n/);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			let currentOffset = 0;
			do {
				const openOffset = line.indexOf('[', currentOffset);
				if (openOffset === -1) {
					break;
				}
				const closeOffset = line.indexOf(']', openOffset);
				if (closeOffset === -1) {
					break;
				}
				const tokenData = this._parseTextToken(line.substring(openOffset + 1, closeOffset));
				r.push({
					line: i,
					startCharacter: openOffset + 1,
					length: closeOffset - openOffset - 1,
					tokenType: tokenData.tokenType,
					tokenModifiers: tokenData.tokenModifiers
				});
				currentOffset = closeOffset;
			} while (true);
		}
		return r;
	}

	_parseTextToken(text) {
		const parts = text.split('.');
		return {
			tokenType: parts[0],
			tokenModifiers: parts.slice(1)
		};
	}
}

module.exports = {
    CompletionHandler: CompletionHandler,
}