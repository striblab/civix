/**
 * Sub command for migrations
 */

// Describe command use
exports.command = 'migrate [migration]';

// Description
exports.describe = 'Setup the database or migrate to a specific migration.';

// Options
exports.builder = {
  migration: {
    default: 'cool'
  }
};

// Migrate
exports.handler = async argv => {
  console.error('Syncing models...');
  const tools = {
    models: require('../../models'),
    config: require('../../config')
  };

  let s = await tools.config.db.sync();
  await tools.config.db.close();
  return s;
};
