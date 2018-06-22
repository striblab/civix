/**
 * Sources model.  A source a general source for data.  For instance,
 * the AP would have a source entry for election results.
 *
 * A piece of data can have many sources.
 */

// Dependencies
const Sequelize = require('sequelize');
const utils = require('../model-utils.js');
const config = require('../../config');

// Model
const Source = config.db.define(
  'source',
  utils.snakeCaseFields(
    utils.extendWithNotes(
      utils.extendWithNames({
        url: {
          type: Sequelize.STRING(128),
          description: 'The jurisdiction name identifier.'
        }
      })
    )
  ),
  {
    underscored: true,
    indexes: utils.snakeCaseIndexes(utils.addNameIndexes([]))
  }
);

// Export
module.exports = Source;
