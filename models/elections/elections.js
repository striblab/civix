/**
 * Elections model
 */

// Dependencies
const Sequelize = require('sequelize');
const config = require('../../config');

// Model
const Elections = config.db.define('elections', {
  date: {
    type: Sequelize.DATEONLY(),
    description: 'The date of the election'
  },
  type: {
    type: Sequelize.ENUM('general', 'primary', 'special'),
    defaultValue: 'general'
  }
});

module.exports = Elections;
