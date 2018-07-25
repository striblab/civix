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
      utils.extendWithNotes(
        utils.extendWithNames({
          abbreviation: {
            type: Sequelize.STRING(32),
            description: 'The abbreviation used by the party.'
          }
        })
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(
        utils.addNameIndexes([{ fields: ['abbreviation'] }])
      )
    }
  );

  // Associate
  model.associate = function({ SourceData }) {
    // Add source fields
    utils.extendWithSources(this, SourceData);
  };

  return model;
};
