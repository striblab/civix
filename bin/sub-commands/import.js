/**
 * Sub command for migrations
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const config = require('../../config');

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

  return yargs;
};

// Import
exports.handler = async argv => {
  // Check for path
  let importer = argv.importer.match(/\.js$/i)
    ? argv.importer
    : path.join(__dirname, '..', '..', 'importers', `${argv.importer}.js`);

  // Logger
  const logger = require('../../lib/logger.js');
  logger.p = logger.makePrefixFn(`civix ${process.argv.splice(2).join(' ')}`);

  // Check for exists
  if (!fs.existsSync(importer)) {
    logger.p('error', `Unable to find importer at ${importer}`);
    return;
  }

  // Try to require
  let importerFunc;
  try {
    importerFunc = require(importer);
  }
  catch (e) {
    logger.p(
      'error',
      `Unable to require ${importer}: ${config.debug ? e.stack : ''}`
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
    await importerFunc({
      logger: logger.p,
      config,
      models: db.models,
      db: db
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
