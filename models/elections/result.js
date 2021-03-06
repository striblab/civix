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
      utils.extendWithSourceData(
        utils.extendWithNotes({
          id: {
            type: Sequelize.STRING(128),
            primaryKey: true,
            description: 'The string ID.'
          },
          apId: {
            type: Sequelize.STRING(128),
            description: 'ID used by the Associated Press.'
          },
          apUpdated: {
            type: Sequelize.DATE(),
            description: 'The Last Updated date from the AP.'
          },
          localId: {
            type: Sequelize.STRING(128),
            description:
              'ID used by the local election officials or generated from.'
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
          },
          incumbent: {
            type: Sequelize.BOOLEAN(),
            description:
              'Whether this candidate is the current incumbent at the time of this contest.',
            defaultValue: false
          },
          winner: {
            type: Sequelize.BOOLEAN(),
            description: 'Whether this candidate is a winner.',
            defaultValue: false
          },
          resultDetails: {
            type: Sequelize.JSON(),
            description:
              'The details of the result, for instance, data on ranked-choice voting.'
          },
          test: {
            type: Sequelize.BOOLEAN(),
            description: 'Whether is test data.',
            defaultValue: false
          }
        })
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes([
        { fields: ['units'] },
        { fields: ['apId'] },
        { fields: ['apUpdated'] },
        { fields: ['localId'] },
        { fields: ['votes'] },
        { fields: ['percent'] },
        { fields: ['winner'] },
        { fields: ['incumbent'] },
        {
          name: 'results_children_id',
          unique: true,
          // The combination of foreign keys needs to be unique
          fields: ['ContestId', 'CandidateId']
        }
      ])
    }
  );

  // Associate
  model.associate = function({ Contest, Candidate }) {
    this.__associations = [];

    // A result is tied to a contest
    this.__associations.push(
      this.belongsTo(Contest, {
        foreignKey: { allowNull: false }
      })
    );

    // A results is tied to a candidate
    this.__associations.push(
      this.belongsTo(Candidate, {
        foreignKey: { allowNull: false }
      })
    );
  };

  return model;
};
