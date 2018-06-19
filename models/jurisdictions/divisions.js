/**
 * Divisions model
 */

// Dependencies
const Sequelize = require('sequelize');
const config = require('../../config');

// Model
const Divisions = config.db.define('divisions', {
  id: {
    type: Sequelize.STRING(128),
    primaryKey: true,
    description: 'The string ID for the division.'
  },
  name: {
    type: Sequelize.STRING(128),
    description: 'The code used for this division.'
  },
  label: {
    type: Sequelize.STRING(128),
    description: 'The label used for this division.'
  }
});

// Parent to a jurisdiction
Divisions.belongsTo(Divisions, { as: 'Parent' });

module.exports = Divisions;
