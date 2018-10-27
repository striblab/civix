/**
 * A draft print output version of results
 */

// Dependencies
const { randomId } = require('../../lib/strings.js');

// Describe command use
exports.command = 'print <election>';

// Description
exports.describe = 'Create output for print.';

// Options
exports.builder = yargs => {
  yargs.positional('election', {
    describe: 'The date of the election to export, such as 2018-11-06.',
    type: 'string'
  });
  yargs.options('upload', {
    describe: 'Upload output to print FTP site.',
    type: 'boolean',
    default: false
  });

  return yargs;
};

// Print
exports.handler = async argv => {
  const db = require('../../lib/db.js');
  const print = require('../../lib/print.js');
  const logger = require('../../lib/logger.js');
  let processId = randomId();

  // Logger
  let prefixedLogger = logger.makePrefixFn(processId);
  prefixedLogger.info(`STARTED: civix ${process.argv.splice(2).join(' ')}`);

  try {
    await print(argv);
    await db.close();
  }
  catch (e) {
    logger.handleError(e, prefixedLogger);
  }

  prefixedLogger.info('ENDED');
};
