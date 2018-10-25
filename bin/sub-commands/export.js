/**
 * Sub command for exporting
 */

// Dependencies
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config');
const { randomId } = require('../../lib/strings.js');

// Describe command use
exports.command = 'export <exporter> [output]';

// Description
exports.describe = 'Export data.';

// Options
exports.builder = yargs => {
  yargs.positional('exporter', {
    describe:
      'A JS file that exports an exporter function, or the path to an exporter found in the Civix project, such as `example/example-exporter`.',
    type: 'string'
  });

  yargs.positional('output', {
    alias: 'o',
    describe:
      'Location of where to output.  Uses CIVIX_EXPORT_PATH environment variable, or `./civix-exports` in the working path, if not provided here.',
    default: config.exportPath,
    type: 'string'
  });

  return yargs;
};

// Import
exports.handler = async argv => {
  let processId = randomId();

  // Check for path
  let exporter = argv.exporter.match(/\.js$/i)
    ? argv.exporter
    : path.join(__dirname, '..', '..', 'exporters', `${argv.exporter}.js`);

  // Logger
  const logger = require('../../lib/logger.js');
  let prefixedLogger = logger.makePrefixFn(processId);
  prefixedLogger.info(`STARTED: civix ${process.argv.splice(2).join(' ')}`);

  // Check for exists
  if (!fs.existsSync(exporter)) {
    logger.handleError(
      new Error(`Unable to find exporter at ${exporter}`),
      prefixedLogger
    );
  }

  // Check for output
  if (!argv.output) {
    logger.handleError(
      new Error('Output should be defined or left as default.'),
      prefixedLogger
    );
  }
  try {
    fs.mkdirpSync(argv.output);
  }
  catch (e) {
    logger.handleError(e, prefixedLogger);
  }

  // Try to require
  let exporterFunc;
  try {
    exporterFunc = require(exporter);
  }
  catch (e) {
    logger.handleError(e, prefixedLogger, `Unable to require ${exporter}`);
  }

  // Setup
  let db;
  try {
    db = require('../../lib/db.js');
    await db.sync();
  }
  catch (e) {
    logger.handleError(e, prefixedLogger, 'Issue with syncing to database');
  }

  // Run importer
  try {
    await exporterFunc({
      logger: logger.p,
      config,
      models: db.models,
      db: db,
      argv
    });
  }
  catch (e) {
    logger.handleError(e, prefixedLogger, 'Importer ran into error');
  }

  await db.close();
  prefixedLogger.info('ENDED');
};
