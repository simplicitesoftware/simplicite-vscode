'use strict';

import { env } from 'vscode';
import { createLogger, transports, format } from 'winston';

const customFormat = format.combine(format.timestamp(), format.printf((info: any) => {
	return `${info.timestamp} - [${info.level.toUpperCase().padEnd(7)}] - ${info.message}`;
}));

export const logger = createLogger({
	format: customFormat,
	transports: [
		new transports.Console({ level: 'silly' })
	]
});

export const addFileTransportOnDesktop = (tempPath: string) => {
	if (env.appHost === 'desktop') {
		logger.add(new transports.File({ filename: tempPath + 'simplicite.log' }));
	}
};


