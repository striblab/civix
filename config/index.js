/**
 * Get config
 */

// Dependencies
const path = require('path');
require('dotenv').load();

// Export
module.exports = {
  appId: 'civix',
  appName: 'Civix',

  // Values coming in from environment variable
  debug: process.env.CIVIX_DEBUG || true,
  databaseURI: process.env.CIVIX_DATABASE_URI,
  logPath: process.env.CIVIX_LOG_PATH || path.join(process.cwd(), '.logs')
};
