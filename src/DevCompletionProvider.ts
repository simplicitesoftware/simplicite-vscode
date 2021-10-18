'use strict';

import { CompletionItem, Uri, CompletionItemProvider, TextDocument, Position, ProviderResult, CompletionList, workspace, CancellationToken, CompletionContext } from 'vscode';
import { crossPlatformPath } from './utils';
import { logger } from './Log';
import { SimpliciteAPIManager } from './SimpliciteAPIManager';
import { objectInfo } from './constant';
import { OpenFileContext } from './interfaces';

export class DevCompletionProvider implements CompletionItemProvider {
    private devInfo: any;
    private moduleDevInfo: any;
    private openFileContext: OpenFileContext;
    constructor (devInfo: any, moduleDevInfo: any, openFileContext: OpenFileContext, ) {
        this.devInfo = devInfo;
        this.moduleDevInfo = moduleDevInfo;
        this.openFileContext = openFileContext;
    }
    
    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
        console.log('provide items');
        return [];
    }

    static getModuleName (workspaceUrl: string): string {
        const decomposedUrl = workspaceUrl.split('/');
        return decomposedUrl[decomposedUrl.length - 1];
    }

    static getFileNameFromPath (filePath: string): string {
		const decomposedPath = filePath.split('/');
		return decomposedPath[decomposedPath.length - 1].replace('.java', '');
	}

    static getWorkspaceFromFileUri (uri: Uri): string {
		return crossPlatformPath(workspace.getWorkspaceFolder(uri)!.uri.path);
	}
}