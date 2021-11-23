import * as path from 'path';
import * as vscode from 'vscode';
import { SimpliciteApiObject } from '../SimpliciteApiObject';

/**
 * Virtual file
 * @class
 */
export class File implements vscode.FileStat {
	type: vscode.FileType;
	ctime: number;
	mtime: number;
	size: number;
	name: string;
	data?: Uint8Array;

	constructor(name: string) {
		this.type = vscode.FileType.File;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
	}
}

/**
 * Virtual file record
 * @class
 */
export class FileRecord {
	obj: string;
	fld: string;
	rowId: number;

	constructor(obj: string, fld: string, rowId: number) {
		this.obj = obj;
		this.fld = fld;
		this.rowId = rowId;
	}
}

/**
 * Virtual directory
 * @class
 */
export class Directory implements vscode.FileStat {
	type: vscode.FileType;
	ctime: number;
	mtime: number;
	size: number;
	name: string;
	entries: Map<string, File | Directory>;

	constructor(name: string) {
		this.type = vscode.FileType.Directory;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
		this.entries = new Map();
	}
}

/**
 * Virtual entry (file or directory)
 * @class
 */
export type Entry = File | Directory;

/**
 * Simplicite virtual file system
 * @class
 */
export class SimpliciteFS implements vscode.FileSystemProvider {
	_app: any;

	constructor (app: any) {
		this._app = app;
	}

	root = new Directory('');

	/**
	 * Stat
	 * @param uri Entry URI
	 */
	stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
		return this._lookup(uri, false);
	}

	/**
	 * Create directory
	 * @param uri Directory URI
	 */
	createDirectory(uri: vscode.Uri): void | Thenable<void> {
		console.log('Create directory: ' + uri.path);
		const basename = path.posix.basename(uri.path);
		const dirname = uri.with({ path: path.posix.dirname(uri.path) });
		const parent = this._lookupAsDirectory(dirname, false);

		const entry = new Directory(basename);
		parent.entries.set(entry.name, entry);
		parent.mtime = Date.now();
		parent.size += 1;
		this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
	}

	/**
	 * Read directory
	 * @param uri Directory URI
	 */
	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
		console.log('Read directory: ' + uri.path);
		const entry = this._lookupAsDirectory(uri, false);
		const result: [string, vscode.FileType][] = [];
		for (const [name, child] of entry.entries) {
			result.push([name, child.type]);
		}
		return result;
	}

	/**
	 * Read file
	 * @param uri File URI
	 */
	readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
		console.log('Read file: ' + uri.path);
		const data = this._lookupAsFile(uri, false).data;
		if (data) {
			return data;
		}
		throw vscode.FileSystemError.FileNotFound(uri);
	}

	/**
	 * Write file
	 * @param uri File URI
	 * @param content File content
	 * @param options Options
	 */
	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void {
		console.log('Write file: ' + uri.path);
		const basename = path.posix.basename(uri.path);
		const parent = this._lookupParentDirectory(uri);
		let entry = parent.entries.get(basename);
		if (entry instanceof Directory) {
			throw vscode.FileSystemError.FileIsADirectory(uri);
		}
		if (!entry && !options.create) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		if (entry && options.create && !options.overwrite) {
			throw vscode.FileSystemError.FileExists(uri);
		}
		if (!entry) {
			entry = new File(basename);
			parent.entries.set(basename, entry);
			this._fireSoon({ type: vscode.FileChangeType.Created, uri });
		}
		entry.mtime = Date.now();
		entry.size = content.byteLength;
		entry.data = content;

		const record: FileRecord | undefined = this.getRecord(uri.path);
		if (record) {
			const obj: any = this._app.getBusinessObject(record.obj);
			obj.getForUpdate(record.rowId, { inlineDocuments: [record.fld] }).then((item: any) => {
				item[record.fld].content = Buffer.from(content).toString('base64');
				obj.update(item).then(() => {
					this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
				});
			});
		} else {
			this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
		}
	}

	private _records: Map<string, FileRecord> = new Map<string, FileRecord>();

	/**
	 * Set file record
	 * @param uri File URI
	 * @param obj Object name
	 * @param fld Field name
	 * @param rowId Row ID
	 */
	setRecord(uri: string, obj: string, fld: string, rowId: number): void {
		this._records.set(uri, new FileRecord(obj, fld, rowId));
	}

	/**
	 * Get file record
	 * @param uri File URI
	 */
	getRecord(uri: string): FileRecord | undefined {
		return this._records.get(uri);
	}

	/**
	 * Delete file <strong>NOT AVAILABLE</strong>
	 * @param uri File URI
	 * @param options Options
	 */
	delete(): void | Thenable<void> {
		throw new Error('delete: method not available.');
	}

	/**
	 * Rename file <strong>NOT AVAILABLE</strong>
	 * @param uri File URI
	 * @param options Options
	 */
	rename(): void | Thenable<void> {
		throw new Error('rename: method not available.');
	}

	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	private _bufferedEvents: vscode.FileChangeEvent[] = [];
	private _fireSoonHandle?: NodeJS.Timer;

	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

	private _lookup(uri: vscode.Uri, silent: false): Entry;
	private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
	private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
		const parts = uri.path.split('/');
		let entry: Entry = this.root;
		for (const part of parts) {
			if (!part) {
				continue;
			}
			let child: Entry | undefined;
			if (entry instanceof Directory) {
				child = entry.entries.get(part);
			}
			if (!child) {
				if (!silent) {
					throw vscode.FileSystemError.FileNotFound(uri);
				} else {
					return undefined;
				}
			}
			entry = child;
		}
		return entry;
	}

	private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
		const entry = this._lookup(uri, silent);
		if (entry instanceof Directory) {
			return entry;
		}
		throw vscode.FileSystemError.FileNotADirectory(uri);
	}

	private _lookupAsFile(uri: vscode.Uri, silent: boolean): File {
		const entry = this._lookup(uri, silent);
		if (entry instanceof File) {
			return entry;
		}
		throw vscode.FileSystemError.FileIsADirectory(uri);
	}

	private _lookupParentDirectory(uri: vscode.Uri): Directory {
		const dirname = uri.with({ path: path.posix.dirname(uri.path) });
		return this._lookupAsDirectory(dirname, false);
	}

	watch(): vscode.Disposable {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		return new vscode.Disposable(() => { });
	}

	private _fireSoon(...events: vscode.FileChangeEvent[]): void {
		this._bufferedEvents.push(...events);

		if (this._fireSoonHandle) {
			clearTimeout(this._fireSoonHandle);
		}

		this._fireSoonHandle = setTimeout(() => {
			this._emitter.fire(this._bufferedEvents);
			this._bufferedEvents.length = 0;
		}, 5);
	}
}