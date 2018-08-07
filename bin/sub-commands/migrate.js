/**
 * Sub command for migrations
 */

// Dependencies
const inquirer = require('inquirer');

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
  yargs.options('drop-tables', {
    describe: 'Drop all tables first.',
    type: 'boolean',
    default: false
  });

  return yargs;
};

// Migrate
exports.handler = async argv => {
  const db = require('../../lib/db.js');
  const logger = require('../../lib/logger.js');

  // Confirm drop
  if (argv.dropTables) {
    let drop = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'dropTables',
        message: 'Drop all tables and re-initialize database.',
        default: false
      }
    ]);

    if (!drop.dropTables) {
      process.exit(1);
    }
  }

  logger.info('Syncing models...');
  await db.sync({ force: argv.dropTables });
  await db.close();
};
