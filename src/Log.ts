'use strict';

const { createLogger, transports, format } = require('winston');
const { LOGS_PATH } = require('./constant');

const customFormat = format.combine(format.timestamp(), format.printf((info) => {
    return `${info.timestamp} - [${info.level.toUpperCase().padEnd(7)}] - ${info.message}`;
}))

const logger = createLogger({
    format: customFormat,
    transports: [
        new transports.Console( { level: 'silly'}),
        new transports.File({ filename: LOGS_PATH, level: 'info'})
    ]
})

module.exports = logger;