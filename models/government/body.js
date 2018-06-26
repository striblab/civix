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
    utils.snakeCaseFields(utils.extendWithNotes(utils.extendWithNames({}))),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(utils.addNameIndexes([]))
    }
  );

  // Associate
  model.associate = function({ Source, SourceData }) {
    // Add source fields
    utils.extendWithSources(this, Source, SourceData);
  };

  return model;
};
