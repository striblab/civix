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
exports.handler = argv => {
  console.error('Syncing models...');
  const tools = {
    models: require('../../models'),
    config: require('../../config')
  };

  return tools.config.db.sync();
};
