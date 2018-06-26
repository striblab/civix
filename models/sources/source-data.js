/**
 * Sources data model.  Source data for a piece of data.  This is
 * to help have a reference and debug.
 *
 * A piece of data can have many source data.
 */

// Dependencies
const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'source_data',
    utils.snakeCaseFields({
      id: {
        type: Sequelize.STRING(128),
        primaryKey: true,
        description: 'The string ID for the source.'
      },
      sourceIdentifier: {
        type: Sequelize.STRING(128),
        description: 'The source identifier; pulled out to help search things.'
      },
      data: {
        type: Sequelize.JSON(),
        description: 'The source data as JSON.'
      }
    }),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes([{ fields: ['sourceIdentifier'] }])
    }
  );

  // Associate
  model.associate = function({ Source }) {
    this.belongsTo(Source, {
      foreignKey: { allowNull: false }
    });
  };

  return model;
};
