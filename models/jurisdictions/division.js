/**
 * Divisions model.
 *
 * A division is the type of jurisidiction, such as county, us-house
 */

// Dependencies
//const Sequelize = require('sequelize');
const config = require('../../config');
const utils = require('../model-utils.js');

// Model
const Division = config.db.define(
  'division',
  utils.snakeCaseFields(utils.extendWithNotes(utils.extendWithNames({}))),
  {
    underscored: true,
    indexes: utils.snakeCaseIndexes(utils.addNameIndexes([]))
  }
);

// Parent to a jurisdiction
Division.belongsTo(Division, { as: 'Parent' });

module.exports = Division;
