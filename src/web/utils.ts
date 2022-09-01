'use strict';

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