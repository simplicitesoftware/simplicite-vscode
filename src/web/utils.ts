'use strict';

import { commands, extensions, window } from "vscode";

export function removeFileExtension(template: string): string {
	let fileName = template;
	for (const valid of SUPPORTED_FILES) {
		const beforeLegnth = fileName.length;
		fileName = template.replace(valid, '');
		if (beforeLegnth > fileName.length) {
			break;
		}
	}
	return fileName;
}

export function recreateLocalUrl(url: string): string {
	if(url.includes('localhost')) url = 'localhost' + url.replace('localhost', ':');
	else if(url.includes('127.0.0.1')) url = '127.0.0.1' + url.replace('127.0.0.1', ':'); 
	return url;
}

export async function compileJava(): Promise<void> {
	// status can have the following values FAILED = 0, SUCCEED = 1, WITHERROR = 2, CANCELLED = 3
	const redhatJava = extensions.getExtension('redhat.java');
	if (redhatJava === undefined) {
		const message = 'Cannot compile workspace, the redhat.java extension is not available, probably not installed or disabled';
		window.showWarningMessage('Simplicite: ' + message);
		throw new Error(message);
	}
	try {
		const status = await commands.executeCommand('java.workspace.compile', false);
		switch (status) {
		case 0:
			window.showErrorMessage('Simplicite: Compilation failed');
			break;
		case 1:
			window.showErrorMessage('Simplicite: Compilation succeeded');
			break;
		case 3:
			window.showErrorMessage('Simplicite: Compilation cancelled');
		}
	} catch (e: any) {
		window.showErrorMessage('Simplicite: An error occured during the compilation. ' + e.message);
	}
}