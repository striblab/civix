/**
 * A draft print output version of results
 */

// Dependencies
const _ = require('lodash');

// Describe command use
exports.command = 'config';

// Description
exports.describe =
  'Outputs configuration; could contain sensitive information.';

// Print
exports.handler = async () => {
  const config = require('../../config');

  _.each(config, (v, k) => {
    console.error(`${k}: ${JSON.stringify(v)}`);
  });
};
