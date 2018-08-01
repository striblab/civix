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
          winner: {
            type: Sequelize.BOOLEAN(),
            description: 'Whether this candidate is a winner.',
            defaultValue: false
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
        { fields: ['localId'] },
        { fields: ['votes'] },
        { fields: ['percent'] },
        {
          unique: true,
          // The combination of foreign keys needs to be unique
          fields: ['ContestId', 'CandidateId', 'ParentId', 'BoundaryVersionId']
        }
      ])
    }
  );

  // Associate
  model.associate = function({ Contest, Candidate, BoundaryVersion, Source }) {
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

    // A results can be a subresult of of other and tied to a specific
    // boundary
    this.__associations.push(this.belongsTo(this, { as: 'parent' }));
    this.__associations.push(this.belongsTo(BoundaryVersion));

    // Add source fields
    utils.extendWithSources(this, Source);
  };

  return model;
};
