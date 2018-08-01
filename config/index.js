/**
 * Get config
 */

// Dependencies
const _ = require('lodash');
const path = require('path');
require('dotenv').load();

// Parse a boolean
function envParseBoolean(input, defaultValue = false) {
  if (input === true || input === false) {
    return input;
  }
  else if (
    input === 1 ||
    (_.isString(input) && input.match(/^(true|yes)$/i))
  ) {
    return true;
  }
  else if (
    input === 0 ||
    (_.isString(input) && input.match(/^(false|no)$/i))
  ) {
    return false;
  }
  else {
    return defaultValue;
  }
}

// Export
module.exports = {
  appId: 'civix',
  appName: 'Civix',

  // Values coming in from environment variable
  debug: process.env.CIVIX_DEBUG || true,
  databaseURI: process.env.CIVIX_DATABASE_URI,
  logPath: process.env.CIVIX_LOG_PATH || path.join(process.cwd(), '.logs'),
  cachePath: process.env.CIVIX_CACHE_PATH || path.join(process.cwd(), '.cache'),
  apAPIKey: process.env.AP_API_KEY,
  elexTest: envParseBoolean(process.env.CIVIX_ELEX_TEST, true)
};
