/**
 * A draft print output version of results
 */

// Dependencies

// Describe command use
exports.command = 'print <election-id>';

// Description
exports.describe = 'Create output for print.';

// Options
exports.builder = yargs => {
  yargs.positional('election-id', {
    describe: 'The ID of the election to export.',
    type: 'string'
  });
  yargs.options('upload', {
    describe: 'Upload output to print FTP site.',
    type: 'boolean',
    default: false
  });

  return yargs;
};

// Print
exports.handler = async argv => {
  const db = require('../../lib/db.js');
  const print = require('../../lib/print.js');

  await print(argv);
  await db.close();
};
