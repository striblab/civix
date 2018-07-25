/**
 * Jurisdictions model.
 *
 * Jurisdiction is an area, such as a precinct.
 */

// Dependencies
const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'jurisdiction',
    utils.snakeCaseFields(
      utils.extendWithNotes(
        utils.extendWithNames({
          localId: {
            type: Sequelize.STRING(128),
            description: 'ID used by local administration.'
          },
          fips: {
            type: Sequelize.STRING(128),
            description: 'The Census FIPS code for the jurisdiction.'
          },
          geometry: {
            // Geometry is a bit simpiler, and we don't intended to do
            // serious mesasurements, so we don't use geography type.
            type: Sequelize.GEOMETRY('POLYGON', 4326),
            description: 'The Census FIPS code for the jurisdiction.'
          }
        })
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(
        utils.addNameIndexes([{ fields: ['fips'] }, { fields: ['localId'] }])
      )
    }
  );

  // Associate
  model.associate = function({ Division, SourceData }) {
    // Parent to a jurisdiction
    this.belongsTo(this, { as: 'parent' });

    // Jurisidcition has a dvision
    this.belongsTo(Division, {
      foreignKey: { allowNull: false }
    });

    // Add source fields
    utils.extendWithSources(this, SourceData);
  };

  return model;
};
