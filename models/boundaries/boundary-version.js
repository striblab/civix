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
    'boundary_version',
    utils.snakeCaseFields(
      utils.extendWithSourceData(
        utils.extendWithNotes({
          id: {
            type: Sequelize.STRING(128),
            primaryKey: true,
            description: 'The string ID.'
          },
          name: {
            type: Sequelize.STRING(128),
            description: 'The human-discernable name identifier (slug).',
            allowNull: false,
            unique: true
          },
          localId: {
            type: Sequelize.STRING(128),
            description: 'ID used by local administration.'
          },
          fips: {
            type: Sequelize.STRING(128),
            description: 'The Census FIPS code for the boundary.'
          },
          start: {
            type: Sequelize.DATEONLY(),
            description:
              'Date that this boundary went into affect, or is the earliest that it is known to be in effect.',
            allowNull: false
          },
          end: {
            type: Sequelize.DATEONLY(),
            description:
              'Date that this boundary is no longer effective, or the last known date that this is the case.'
          },
          geometry: {
            // Geometry is a bit simpiler, and we don't intended to do
            // serious mesasurements, so we don't use geography type.
            type: Sequelize.GEOMETRY('POLYGON', 4326),
            description: 'The geospatial boundary.'
          }
        })
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes([
        { fields: ['fips'] },
        { fields: ['localId'] },
        { fields: ['start'] },
        { fields: ['end'] },
        // Boundary ID and start must be unique
        { unique: true, fields: ['start', 'BoundaryId'] }
      ])
    }
  );

  // Associate
  model.associate = function({ Boundary, Source }) {
    this.__associations = [];

    // Boundary version has a main boundary
    this.__associations.push(
      this.belongsTo(Boundary, {
        foreignKey: { allowNull: false }
      })
    );

    // Add source fields
    utils.extendWithSources(this, Source);
  };

  return model;
};
