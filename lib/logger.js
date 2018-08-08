/**
 * Setting up a general logger for the application
 */

// Depedencies
const path = require('path');
const fs = require('fs-extra');
const winston = require('winston');
const config = require('../config');

// Make sure it's there
fs.mkdirpSync(config.logPath);

// Main file logger
const logger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: path.join(config.logPath, `${config.appId}.all.log`),
      //handleExceptions: true,
      maxsize: 1000000 * 100,
      maxFiles: 3
    }),
    new winston.transports.File({
      filename: path.join(config.logPath, `${config.appId}.info.log`),
      level: 'info',
      maxsize: 1000000 * 100,
      maxFiles: 3
    }),
    new winston.transports.File({
      filename: path.join(config.logPath, `${config.appId}.error.log`),
      level: 'error',
      maxsize: 1000000 * 100,
      maxFiles: 3
    })
  ]
});

// Output to console
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
      //handleExceptions: true
    })
  );
}

// Add a simple prefixer function
logger.makePrefixFn = prefix => {
  return (method = 'info', ...args) => {
    let message = args.shift();
    return logger[method](`[${prefix}] ${message}`, ...args);
  };
};

// Create Database specific logger
const { combine, timestamp, label, prettyPrint } = winston.format;
const dbLogger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: path.join(config.logPath, `${config.appId}.db.log`),
      maxsize: 1000000 * 200,
      maxFiles: 3
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
process.on('uncaughtException', error => {
  logger.error(error);
});

// Handle unhandled rejections
process.on('unhandledRejection', error => {
  logger.error(error);
});

// Export
module.exports = logger;
