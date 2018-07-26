/**
 * Divisions model.
 *
 * A division is the type of boundary, such as county, us-house
 */

// Dependencies
//const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'division',
    utils.snakeCaseFields(utils.extendWithNotes(utils.extendWithNames({}))),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(utils.addNameIndexes([]))
    }
  );

  // Associate
  model.associate = function({ SourceData }) {
    // Parent to a jurisdiction
    this.belongsTo(this, { as: 'parent' });

    // Add source fields
    utils.extendWithSources(this, SourceData);
  };

  return model;
};
