/**
 * Sub command for migrations
 */

// Describe command use
exports.command = 'migrate [migration]';

// Description
exports.describe = 'Setup the database or migrate to a specific migration.';

// Options
exports.builder = yargs => {
  yargs.positional('migration', {
    describe: 'TODO',
    type: 'string'
  });

  return yargs;
};

// Migrate
exports.handler = async argv => {
  const db = require('../../lib/db.js');
  const logger = require('../../lib/logger.js');
  logger.info('Syncing models...');
  await db.sync();
  await db.close();
};
