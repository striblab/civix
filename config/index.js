/**
 * Get config
 */

// Dependencies
const _ = require('lodash');
const path = require('path');
const json = require('json5');
require('dotenv').load();
const debug = require('debug')('civix:config');

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

// Parse an array
function envParseArray(input, strictArray = false, defaultValue = null) {
  if (input) {
    if (!strictArray && _.isString(input) && input[0] !== '[') {
      return input;
    }

    try {
      return json.parse(input);
    }
    catch (e) {
      debug(`Unable to parse array from: ${input}`);
      debug(e);
      return defaultValue;
    }
  }

  return defaultValue;
}

// Make global to ensure its the same across imports
global.config = global.config || {
  appId: 'civix',
  appName: 'Civix',

  // Values (possibly)coming in from environment variable
  debug: process.env.CIVIX_DEBUG || false,
  databaseURI: process.env.CIVIX_DATABASE_URI,
  logPath: process.env.CIVIX_LOG_PATH || path.join(process.cwd(), '.logs'),
  cachePath: process.env.CIVIX_CACHE_PATH || path.join(process.cwd(), '.cache'),
  exportPath:
    process.env.CIVIX_EXPORT_PATH || path.join(process.cwd(), 'civix-exports'),
  apAPIKey: process.env.AP_API_KEY,
  testResults: envParseBoolean(process.env.CIVIX_TEST_RESULTS, false),
  mnElectionsTestLevel: process.env.CIVIX_MN_ELECTIONS_TEST_LEVEL || 'middle',
  elexFakeFiles: envParseArray(process.env.CIVIX_ELEX_FAKE_FILES, false, null),
  elexCountyContests: envParseArray(
    process.env.CIVIX_ELEX_COUNTY_CONTESTS,
    false,
    null
  ),
  ftpPrintHost: process.env.PRINT_FTP_HOST,
  ftpPrintUser: process.env.PRINT_FTP_USER,
  ftpPrintPass: process.env.PRINT_FTP_PASS,
  ftpPrintPutLocation: process.env.PRINT_FTP_PUT_LOCATION,
  mnSosFtpUser: process.env.MN_SOS_FTP_USER,
  mnSosFtpPass: process.env.MN_SOS_FTP_PASS
};

// Export
module.exports = global.config;
