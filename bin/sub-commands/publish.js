/**
 * Sub command for exporting
 */

// Dependencies
const fs = require('fs-extra');
const config = require('../../config');
const publisher = require('../../lib/publish.js');
const { randomId } = require('../../lib/strings.js');

// Describe command use
exports.command = 'publish <s3-path> [region] [export-path]';

// Description
exports.describe = 'Publish data to S3.';

// Options
exports.builder = yargs => {
  yargs.positional('s3-path', {
    describe:
      'The place on S3 to upload to, such as `s3://bucket/path/civix-exports`.',
    type: 'string'
  });

  yargs.positional('region', {
    alias: 'r',
    describe: 'The S3 region to use.',
    type: 'string'
  });

  yargs.positional('export-path', {
    alias: 'e',
    describe:
      'The path where the civix exports are.  Uses CIVIX_EXPORT_PATH environment variable, or `./civix-exports` in the working path, if not provided here.',
    default: config.exportPath,
    type: 'string'
  });

  return yargs;
};

// Import
exports.handler = async argv => {
  const logger = require('../../lib/logger.js');
  let processId = randomId();

  // Logger
  let prefixedLogger = logger.makePrefixFn(processId);
  prefixedLogger.info(`STARTED: civix ${process.argv.splice(2).join(' ')}`);

  // Check for export path
  if (!argv.exportPath) {
    logger.handleError(
      new Error('"export-path" should be defined or left as default.'),
      prefixedLogger
    );
  }

  // Check it exists
  if (!fs.existsSync(argv.exportPath)) {
    logger.handleError(
      new Error(`Unable to to find export path: ${argv.exportPath}`),
      prefixedLogger
    );
  }

  // Publish
  try {
    await publisher({
      s3Location: argv.s3Path,
      exportsPath: argv.exportPath,
      s3Region: argv.region
    });
  }
  catch (e) {
    logger.handleError(
      exports,
      prefixedLogger,
      'Error trying to publish to S3.  Set DEBUG=civix:* environment variable to get more information.'
    );
  }

  prefixedLogger.info('ENDED');
};
