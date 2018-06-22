/**
 * Jurisdictions model.
 *
 * Jurisdiction is an area, such as a precinct.
 */

// Dependencies
const Sequelize = require('sequelize');
const Division = require('./division');
const sources = require('../sources');
const utils = require('../model-utils.js');
const config = require('../../config');

// Model
const Jurisdiction = config.db.define(
  'jurisdiction',
  utils.snakeCaseFields(
    utils.extendWithNotes(
      utils.extendWithNames({
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
      utils.addNameIndexes([{ fields: ['fips'] }])
    )
  }
);

// Parent to a jurisdiction
Jurisdiction.belongsTo(Jurisdiction, { as: 'parent' });

// Jurisidcition has a dvision
Jurisdiction.belongsTo(Division);

// Add source fields
utils.extendWithSources(Jurisdiction, sources);

// Export
module.exports = Jurisdiction;
