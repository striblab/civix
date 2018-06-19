/**
 * Connect to database
 */

// Dependencies
const Sequelize = require('sequelize');
require('dotenv').load();

// Create sequelize instance
const sequelize = new Sequelize(process.env.CIVIX_DATABASE_URI);

// Export
module.exports = sequelize;
