/**
 * Jurisdictions model
 */

// Dependencies
const Sequelize = require('sequelize');
const Divisions = require('./divisions.js');
const config = require('../../config');

// Model
const Jurisdictions = config.db.define('jurisdictions', {
  id: {
    type: Sequelize.STRING(128),
    primaryKey: true,
    description: 'The string ID for the jurisdiction.'
  },
  fips: {
    type: Sequelize.STRING(128),
    description: 'The Census FIPS code for the jurisdiction.'
  }
  // division
  // sources
});

// Parent to a jurisdiction
Jurisdictions.belongsTo(Jurisdictions, { as: 'Parent' });

// Jurisidcition has a dvision
Jurisdictions.hasOne(Divisions);

// Export
module.exports = Jurisdictions;
