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
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes([
        { fields: ['name'] },
        { fields: ['fullName'] },
        { fields: ['shortName'] },
        { fields: ['sort'] }
      ])
    }
  );

  model.associate = function({ Contest, Source, SourceData }) {
    // Each candidate belongs to a contest
    this.belongsTo(Contest, {
      foreignKey: { allowNull: false }
    });

    // Add source fields
    utils.extendWithSources(this, Source, SourceData);
  };

  return model;
};
