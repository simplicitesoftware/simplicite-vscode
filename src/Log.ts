'use strict';

import { createLogger, transports, format } from 'winston';
import { env } from 'vscode';

const customFormat = format.combine(format.timestamp(), format.printf((info: any) => {
	return `${info.timestamp} - [${info.level.toUpperCase().padEnd(7)}] - ${info.message}`;
}));

export const logger = createLogger({
	format: customFormat,
	transports: loggerList()
});

function loggerList () {
	const loggerList = [];
	loggerList.push(new transports.Console({ level: 'silly' }));
	if (env.appHost === 'desktop') {
		loggerList.push(new transports.File({ filename: STORAGE_PATH + 'simplicite.log', level: 'info'}));
	}
	return loggerList;
}

