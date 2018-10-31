/**
 * Sub command for importing
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const config = require('../../config');
const { randomId } = require('../../lib/strings.js');

// Describe command use
exports.command = 'import <importer>';

// Description
exports.describe = 'Import data using an importer.';

// Options
exports.builder = yargs => {
  yargs.positional('importer', {
    describe:
      'A JS file that exports an importer function, or the path to an importer found in the Civix project, such as `example/example-importer`.',
    type: 'string'
  });
  yargs.options('update', {
    describe:
      'For most importers, importers won\'t update existing data, use this flag to update records that are already there.',
    type: 'boolean',
    default: false
  });
  yargs.options('test', {
    describe:
      'Turns test on, or use --no-test to turn it off.  Override environment variable: CIVIX_TEST_RESULTS',
    type: 'boolean',
    default: undefined
  });

  return yargs;
};

// Import
exports.handler = async argv => {
  let processId = randomId();

  // Check for path
  let importer = argv.importer.match(/\.js$/i)
    ? argv.importer
    : path.join(__dirname, '..', '..', 'importers', `${argv.importer}.js`);

  // Logger
  const logger = require('../../lib/logger.js');
  let prefixedLogger = logger.makePrefixFn(processId);
  prefixedLogger.info(`STARTED: civix ${process.argv.splice(2).join(' ')}`);

  // Check for exists
  if (!fs.existsSync(importer)) {
    logger.handleError(
      new Error(`Unable to find importer at ${importer}`),
      prefixedLogger
    );
  }

  // Update test if explicit
  if (_.isBoolean(argv.test)) {
    config.testResults = argv.test;
  }

  // Try to require
  let importerFunc;
  try {
    importerFunc = require(importer);
  }
  catch (e) {
    logger.handleError(e, prefixedLogger);
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
    await importerFunc({
      logger: prefixedLogger,
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
