/**
 * Setting up a general logger for the application
 */

// Depedencies
const path = require('path');
const fs = require('fs-extra');
const winston = require('winston');
const config = require('../config');
const debug = require('debug')('civix:logger');
const util = require('util');

// Make sure it's there
fs.mkdirpSync(config.logPath);

// To get timestamp output, we need to create our own format function
const customFormat = winston.format.printf((info, ...other) => {
  return `[${info.timestamp}] [${info.level}]: ${info.message} ${
    other && other.length ? '\n' + JSON.stringify(other) : ''
  }`;
});

// Main file logger
const logger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), customFormat),
  transports: [
    new winston.transports.File({
      filename: path.join(config.logPath, `${config.appId}.all.log`),
      //handleExceptions: true,
      maxsize: 1000000 * 100,
      maxFiles: 3,
      timestamp: true
    }),
    new winston.transports.File({
      filename: path.join(config.logPath, `${config.appId}.info.log`),
      level: 'info',
      maxsize: 1000000 * 100,
      maxFiles: 3,
      timestamp: true
    }),
    new winston.transports.File({
      filename: path.join(config.logPath, `${config.appId}.error.log`),
      level: 'error',
      maxsize: 1000000 * 100,
      maxFiles: 3,
      timestamp: true
    })
  ]
});

// Output to console
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        customFormat
      ),
      timestamp: true
      //handleExceptions: true
    })
  );
}

// Add a simple prefixer function
logger.makePrefixFn = prefix => {
  return {
    info: (...args) => {
      let message = args.shift();
      return logger.info(`[${prefix}] ${message}`, ...args);
    },
    error: (...args) => {
      let message = args.shift();
      return logger.error(`[${prefix}] ${message}`, ...args);
    }
  };
};

// Create Database specific logger
const { combine, timestamp, label, prettyPrint } = winston.format;
const dbLogger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: path.join(config.logPath, `${config.appId}.db.log`),
      maxsize: 1000000 * 200,
      maxFiles: 3,
      timestamp: true
      // this is supposed to not zip the current file, but it does.
      //zippedArchive: true
    })
  ],
  format: combine(label({ label: 'DB' }), timestamp(), prettyPrint())
});

// Add to default logger
logger.dbLogger = dbLogger;
logger.db = function(...args) {
  // Sequelize passes along the sequelize object as well
  dbLogger.info([...args][0]);
};

// Handle uncaught exceptions
process.on('uncaughtException', handleError);

// Handle unhandled rejections
process.on('unhandledRejection', handleError);

// Handle error
function handleError(error, customLogger, customMessage) {
  customLogger = customLogger || logger;

  // There seems to be a condition where the customLogger
  // does not have the error function, but there's not stack trace
  if (!customLogger || !customLogger.error) {
    customLogger = logger;
  }

  if (customMessage) {
    customLogger.error(customMessage);
  }

  if (!error) {
    customLogger.error('Unknown error');
    process.exit(1);
  }

  let message = error.message
    ? error.message
    : error.toString
      ? error.toString()
      : error.response
        ? error.response
        : error;
  let code = error.code
    ? error.code
    : error.name
      ? error.name
      : error.errno
        ? error.errno
        : undefined;
  customLogger.error(`${code ? '[' + code + '] ' : ''}${message}`);

  if (config.debug) {
    debug(util.inspect(error, false, null, true));
    if (error.stack) {
      debug(error.stack);
    }
  }

  process.exit(1);
}
logger.handleError = handleError;

// Export
module.exports = logger;
