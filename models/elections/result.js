/**
 * Results model.
 *
 * Actual results of a contest.
 */

// Dependencies
const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'results',
    utils.snakeCaseFields(
      utils.extendWithNotes({
        id: {
          type: Sequelize.STRING(128),
          primaryKey: true,
          description: 'The string ID.'
        },
        units: {
          type: Sequelize.ENUM('votes', 'electoral-votes', 'other'),
          description: 'The type of units these results describe.',
          allowNull: false,
          defaultValue: 'votes'
        },
        votes: {
          type: Sequelize.INTEGER(),
          description: 'The total number of votes cast for this candidate.'
        },
        percent: {
          type: Sequelize.DECIMAL(),
          description:
            'The between-0-and-1 percent of votes for this candidate.'
        }
      })
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes([
        { fields: ['units'] },
        { fields: ['votes'] },
        { fields: ['percent'] },
        {
          unique: true,
          // The combination of foreign keys needs to be unique
          fields: ['ContestId', 'CandidateId', 'ParentId', 'JurisdictionId']
        }
      ])
    }
  );

  // Associate
  model.associate = function({ Contest, Candidate, Jurisdiction, SourceData }) {
    // A result is tied to a contest
    this.belongsTo(Contest, {
      foreignKey: { allowNull: false }
    });

    // A results is tied to a candidate
    this.belongsTo(Candidate, {
      foreignKey: { allowNull: false }
    });

    // A results can be a subresult of of other
    this.belongsTo(this, { as: 'parent' });
    this.belongsTo(Jurisdiction);

    // Add source fields
    utils.extendWithSources(this, SourceData);
  };

  return model;
};
