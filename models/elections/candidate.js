/**
 * Candidate model.
 *
 * A candidate is tied to a specific contest.  If a candidate
 * is in another contest in another election, that should be
 * tied somewhere else.
 */

// Dependencies
const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'candidate',
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
          apId: {
            type: Sequelize.STRING(128),
            description:
              'ID used by the Associated Press; note that the AP does not maintain unique IDs across elections, so this should be the most recent .'
          },
          apIdHistory: {
            type: Sequelize.JSON(),
            description: 'Array of past AP IDs.'
          },
          localId: {
            type: Sequelize.STRING(128),
            description:
              'ID used by the local election officials or generated from.  This should be the most recent.'
          },
          localIdHistory: {
            type: Sequelize.JSON(),
            description: 'Array of past local IDs.'
          },
          first: {
            type: Sequelize.STRING(256),
            description: 'The candidates first name.',
            allowNull: false
          },
          last: {
            type: Sequelize.STRING(256),
            description: 'The candidates last name.',
            allowNull: false
          },
          middle: {
            type: Sequelize.STRING(256),
            description: 'The candidates middle name.'
          },
          prefix: {
            type: Sequelize.STRING(256),
            description: 'Prefix for candidate.'
          },
          suffix: {
            type: Sequelize.STRING(256),
            description: 'Suffix for candidate.'
          },
          fullName: {
            type: Sequelize.STRING(256),
            description:
              'The candidates full name that is displayed for publication.',
            allowNull: false
          },
          shortName: {
            type: Sequelize.STRING(256),
            description:
              'The short name used for publication, probably the last name of the candidate.'
          },
          sort: {
            type: Sequelize.STRING(256),
            description:
              'The full name used for sorting, such as last name first.'
          }
        })
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes([
        { fields: ['name'] },
        { fields: ['first'] },
        { fields: ['middle'] },
        { fields: ['last'] },
        { fields: ['prefix'] },
        { fields: ['suffix'] },
        { fields: ['fullName'] },
        { fields: ['shortName'] },
        { fields: ['sort'] }
      ])
    }
  );

  model.associate = function({ Party }) {
    this.__associations = [];

    // Each candidate belongs to a party
    this.__associations.push(
      this.belongsTo(Party, {
        foreignKey: { allowNull: false }
      })
    );
  };

  return model;
};
