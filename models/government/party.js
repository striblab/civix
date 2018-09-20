/**
 * Political party model.
 */

// Dependencies
const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'party',
    utils.snakeCaseFields(
      utils.extendWithSourceData(
        utils.extendWithNotes(
          utils.extendWithNames({
            apId: {
              type: Sequelize.STRING(32),
              description: 'The AP code for the party.'
            },
            abbreviation: {
              type: Sequelize.STRING(32),
              description: 'The abbreviation used by the party.'
            }
          })
        )
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(
        utils.addNameIndexes([
          { fields: ['apId'] },
          { fields: ['abbreviation'] }
        ])
      )
    }
  );

  // Associate
  model.associate = function() {
    this.__associations = [];
  };

  return model;
};
