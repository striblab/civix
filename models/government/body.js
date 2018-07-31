/**
 * Body model.
 *
 * A collection of offices
 */

// Dependencies
//const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'body',
    utils.snakeCaseFields(
      utils.extendWithSourceData(
        utils.extendWithNotes(utils.extendWithNames({}))
      ),
      {
        underscored: true,
        indexes: utils.snakeCaseIndexes(utils.addNameIndexes([]))
      }
    )
  );

  // Associate
  model.associate = function({ Source }) {
    this.__associations = [];

    // Add source fields
    utils.extendWithSources(this, Source);
  };

  return model;
};
