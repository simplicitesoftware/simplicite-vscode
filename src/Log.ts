'use strict';

import { createLogger, transports, format } from 'winston';
import { LOGS_PATH } from './constant'; 

const customFormat = format.combine(format.timestamp(), format.printf((info: any) => {
    return `${info.timestamp} - [${info.level.toUpperCase().padEnd(7)}] - ${info.message}`;
}));

export const logger = createLogger({
    format: customFormat,
    transports: [
        new transports.Console( { level: 'silly'}),
        new transports.File({ filename: LOGS_PATH, level: 'info'})
    ]
});

