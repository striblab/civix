/**
 * Connect to database
 */

// Dependencies
const Sequelize = require('sequelize');
const path = require('path');
const glob = require('glob');
const _ = require('lodash');
const logger = require('./logger.js');
const config = require('../config');

// Database object
class Database {
  constructor() {
    this.sequelize = new Sequelize(config.databaseURI, {
      logging: logger.db
    });
    this.importModels();
  }

  // Import models
  // https://sequelize.readthedocs.io/en/v3/docs/models-definition/#import
  importModels() {
    if (this.models) {
      return;
    }

    // Get model files to import
    let modelFiles = glob.sync(path.join(__dirname, '../models/*/**/*.js'), {
      ignore: ['**/index.js', '**/*utils.js']
    });

    // Import models
    this.models = {};
    modelFiles.forEach(f => {
      let name = path.basename(f, '.js');
      name = _.startCase(_.camelCase(name)).replace(/\s+/g, '');
      this.models[name] = this.sequelize.import(f);
    });

    // Asscociate
    _.each(this.models, m => {
      if (_.isFunction(m.associate)) {
        m.associate(this.models);
      }
    });
  }

  // Authenticate (test connection)
  async connect() {
    return await this.sequelize.authenticate();
  }

  // Sync
  async sync() {
    await this.connect();
    return await this.sequelize.sync();
  }

  // Close DB
  async close() {
    return await this.sequelize.close();
  }
}

// Use a global to stor a single database instance
global.db = global.db || new Database();

// Export
module.exports = global.db;
