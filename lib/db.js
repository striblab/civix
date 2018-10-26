/**
 * Connect to database
 */

// Dependencies
const Sequelize = require('sequelize');
const path = require('path');
const glob = require('glob');
const _ = require('lodash');
const crypto = require('crypto');
const logger = require('./logger.js');
const config = require('../config');
//const debug = require('debug')('civix:db');

// Database object
class Database {
  constructor() {
    this.Sequelize = Sequelize;
    this.sequelize = new Sequelize(config.databaseURI, {
      logging: logger.db
    });

    // Fix for output of decimal as strings
    // https://github.com/sequelize/sequelize/issues/8019
    Sequelize.postgres.DECIMAL.parse = function(value) {
      return parseFloat(value);
    };

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
  async sync(options = {}) {
    await this.connect();
    return await this.sequelize.sync(options);
  }

  // Close DB
  async close() {
    return await this.sequelize.close();
  }

  // Custom findOrCreate since the default one is
  // weird
  findOrCreateOne(model, options = {}) {
    return model
      .findOne({
        where: options.where,
        transaction: options.transaction,
        include: options.include || model.__associations || [{ all: true }]
      })
      .then(m => {
        if (m) {
          return new Promise(resolve => resolve([m, false]));
        }

        return model
          .create(options.defaults, {
            transaction: options.transaction,
            include: options.include || model.__associations || [{ all: true }]
          })
          .then(m => {
            return new Promise(resolve => resolve([m, true]));
          });
      });
  }

  // Update existing or create new one
  updateOrCreateOne(model, options = {}) {
    options.trim = _.isBoolean(options.trim) ? options.trim : true;

    return model
      .findOne({
        where: options.where,
        transaction: options.transaction,
        include: options.include || model.__associations || [{ all: true }]
      })
      .then(m => {
        if (m) {
          // Update, allow to pick specific properties to update
          return m
            .update(
              options.pick
                ? _.pick(options.defaults, options.pick)
                : options.trim
                  ? _.omitBy(options.defaults, _.isUndefined)
                  : options.defaults,
              {
                transaction: options.transaction,
                include: options.include ||
                  model.__associations || [{ all: true }]
              }
            )
            .then(u => [u, false]);
        }

        // Create new
        return model
          .create(options.defaults, {
            transaction: options.transaction,
            include: options.include || model.__associations || [{ all: true }]
          })
          .then(m => {
            return new Promise(resolve => resolve([m, true]));
          });
      });
  }

  // A findOne that uses a cache
  findOneCached(model, options, cache = true) {
    this.findOneCache = this.findOneCache || {};
    let requestId = this.hash(options);

    if (cache && this.findOneCache[requestId]) {
      //debug('findOne cache used');
      return new Promise(resolve => resolve(this.findOneCache[requestId]));
    }

    return model.findOne(options).then(response => {
      this.findOneCache[requestId] = response;
      return new Promise(resolve => resolve(this.findOneCache[requestId]));
    });
  }

  // Make an id appropriate for the database and common issues
  makeIdentifier(parts = []) {
    if (_.isString(parts)) {
      parts = [parts];
    }
    else if (!_.isArrayLikeObject(parts)) {
      throw new Error(
        'input provided to makeIdentifier no array or object-like.'
      );
    }

    let formatted = _.filter(
      _.map(_.filter(parts), p => {
        return p
          .toString()
          .replace(/([0-9]{4})-([0-9]{2})-([0-9]{2})/g, '$1$2$3')
          .replace(/(^|\s)u\.s\.a?(\s|\.|$)/gi, '$1us$2')
          .replace(/[^0-9a-z-]/gi, '')
          .trim();
      })
    );

    return _.kebabCase(formatted.join(' '));
  }

  // Make sort out of title
  makeSort(title) {
    if (!_.isString(title)) {
      return title;
    }

    // Pad numbers
    return title
      .toLowerCase()
      .replace(/([0-9]+)/g, (match, number) => {
        return number.padStart(8, '0');
      })
      .replace(/\s+/g, ' ')
      .replace(/[^0-9a-z\s]/gi, '');
  }

  hash(input) {
    return crypto
      .createHash('md5')
      .update(_.isString(input) ? input : JSON.stringify(input))
      .digest('hex');
  }
}

// Use a global to stor a single database instance
global.db = global.db || new Database();

// Export
module.exports = global.db;
