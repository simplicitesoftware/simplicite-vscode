'use strict';

const { createLogger, transports, format } = require('winston');
const { LOGS_PATH } = require('./constant');

<<<<<<< HEAD
const customFormat = format.combine(format.timestamp(), format.printf((info: any) => {
    return `${info.timestamp} - [${info.level.toUpperCase().padEnd(7)}] - ${info.message}`;
}))

export const logger = createLogger({
=======
const customFormat = format.combine(format.timestamp(), format.printf((info) => {
    return `${info.timestamp} - [${info.level.toUpperCase().padEnd(7)}] - ${info.message}`;
}))

const logger = createLogger({
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
    format: customFormat,
    transports: [
        new transports.Console( { level: 'silly'}),
        new transports.File({ filename: LOGS_PATH, level: 'info'})
    ]
})

<<<<<<< HEAD
=======
module.exports = logger;
>>>>>>> 3a25893f0d471589f8dee6c54e46aa59e6269cdf
