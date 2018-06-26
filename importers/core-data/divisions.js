/**
 * Importer for core data: Divisions
 *
 * Divisions describe jurisdiction divisions, such a
 * state.  They are a way to group jurisdiction.
 */

// Dependencies
const ensureSource = require('./source.js');

// Import function
module.exports = async function coreDataDivisionsImporter({ logger, models }) {
  logger('info', 'Core data: Divisions importer...');
  let source = await ensureSource({ models });

  // ...
};
