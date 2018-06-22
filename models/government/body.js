/**
 * Body model.
 *
 * A collection of offices
 */

// Dependencies
//const Sequelize = require('sequelize');
const config = require('../../config');
const sources = require('../sources');
const utils = require('../model-utils.js');

// Model
const Body = config.db.define(
  'body',
  utils.snakeCaseFields(utils.extendWithNotes(utils.extendWithNames({}))),
  {
    underscored: true,
    indexes: utils.snakeCaseIndexes(utils.addNameIndexes([]))
  }
);

// Add source fields
utils.extendWithSources(Body, sources);

module.exports = Body;
