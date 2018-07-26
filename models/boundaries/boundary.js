/**
 * Boundary model.
 *
 * Boundary is an area, such as a precinct.
 */

// Dependencies
const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'boundary',
    utils.snakeCaseFields(
      utils.extendWithNotes(
        utils.extendWithNames({
          localId: {
            type: Sequelize.STRING(128),
            description: 'ID used by local administration.'
          }
        })
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(
        utils.addNameIndexes([{ fields: ['localId'] }])
      )
    }
  );

  // Associate
  model.associate = function({ Division, SourceData }) {
    // Parent to another boundary
    this.belongsTo(this, { as: 'parent' });

    // Boundary has a division
    this.belongsTo(Division, {
      foreignKey: { allowNull: false }
    });

    // Add source fields
    utils.extendWithSources(this, SourceData);
  };

  return model;
};
