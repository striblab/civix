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
    utils.snakeCaseFields(
      utils.extendWithSourceData(
        utils.extendWithNotes(utils.extendWithNames({}))
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(utils.addNameIndexes([]))
    }
  );

  // Associate
  model.associate = function() {
    this.__associations = [];

    // Parent another division
    this.__associations.push(this.belongsTo(this, { as: 'parent' }));
  };

  return model;
};
