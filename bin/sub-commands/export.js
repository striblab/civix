/**
 * Sub command for exporting
 */

// Dependencies
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config');

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
      'Location of where to output.  Uses CIVIX_EXPORT_PATH environment variable, or civix-exports in current path, if not provided here.',
    default: config.exportPath,
    type: 'string'
  });

  return yargs;
};

// Import
exports.handler = async argv => {
  // Check for path
  let exporter = argv.exporter.match(/\.js$/i)
    ? argv.exporter
    : path.join(__dirname, '..', '..', 'exporters', `${argv.exporter}.js`);

  // Logger
  const logger = require('../../lib/logger.js');
  logger.p = logger.makePrefixFn(`civix ${process.argv.splice(2).join(' ')}`);

  // Check for exists
  if (!fs.existsSync(exporter)) {
    logger.p('error', `Unable to find exporter at ${exporter}`);
    return;
  }

  // Check for output
  if (!argv.output) {
    logger.p('error', 'Output should be defined or left as default.');
    return;
  }
  try {
    fs.mkdirpSync(argv.output);
  }
  catch (e) {
    logger.p('error', `Unable to create output path ${argv.output}`);
    return;
  }

  // Try to require
  let exporterFunc;
  try {
    exporterFunc = require(exporter);
  }
  catch (e) {
    logger.p(
      'error',
      `Unable to require ${exporter}: ${config.debug ? e.stack : ''}`
    );
  }

  // Setup
  let db;
  try {
    db = require('../../lib/db.js');
    await db.sync();
  }
  catch (e) {
    logger.p(
      'error',
      `Issue with syncing to database: ${e}: ${config.debug ? e.stack : ''}`
    );
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
    logger.p(
      'error',
      `Importer ran into error: ${e}: ${config.debug ? e.stack : ''}`
    );
  }

  await db.close();
};
