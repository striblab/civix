/**
 * Body model.
 *
 * A collection of offices
 */

// Dependencies
const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'body',
    utils.snakeCaseFields(
      utils.extendWithSourceData(
        utils.extendWithNotes(
          utils.extendWithNames({
            stateCode: {
              type: Sequelize.STRING(8),
              description:
                'The state postal code for this body, should be there except for President.'
            }
          })
        )
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(
        utils.addNameIndexes([{ fields: ['stateCode'] }])
      )
    }
  );

  // Associate
  model.associate = function() {
    this.__associations = [];
  };

  return model;
};
