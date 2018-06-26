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
    {
      id: {
        type: Sequelize.STRING(128),
        primaryKey: true,
        description: 'The string ID for the source.'
      },
      type: {
        type: Sequelize.STRING(128),
        description: 'The format of the data, such as json, or csv.'
      },
      sourceIdentifier: {
        type: Sequelize.STRING(128),
        description: 'The source identifier; pulled out to help search things.'
      },
      data: {
        type: Sequelize.TEXT(),
        description: 'The source data, probably serialized JSON.'
      }
    },
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes([
        { fields: ['type'] },
        { fields: ['data'] }
      ])
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
