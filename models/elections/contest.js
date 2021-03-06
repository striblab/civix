/**
 * Elections model.
 *
 * An Election describes a day where there are elections.  Jurisdiction
 * is the largest jurisidction that is having elections,
 * probably the US, or a state, but may be a specific county.
 */

// Dependencies
const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'contest',
    utils.snakeCaseFields(
      utils.extendWithNotes(
        utils.extendWithSourceData(
          utils.extendWithNames({
            description: {
              type: Sequelize.TEXT(),
              description: 'General description of this contest.'
            },
            localId: {
              type: Sequelize.STRING(128),
              description: 'ID used by local administration, likely the state.'
            },
            apId: {
              type: Sequelize.STRING(128),
              description: 'ID used by the Associated Press.'
            },
            type: {
              type: Sequelize.ENUM('general', 'primary'),
              description:
                'The type of the election for this specific contest; overriding the election value.',
              allowNull: true
            },
            special: {
              type: Sequelize.BOOLEAN(),
              description: 'Whether this contest is "special".',
              allowNull: false,
              defaultValue: false
            },
            elect: {
              type: Sequelize.INTEGER(),
              description: 'The number of candidates being elected or chosen.',
              allowNull: false,
              defaultValue: 1
            },
            uncontested: {
              type: Sequelize.BOOLEAN(),
              description:
                'Whether this contest is uncontested (ignoring write-ins).',
              allowNull: false,
              defaultValue: false
            },
            partisan: {
              type: Sequelize.BOOLEAN(),
              description: 'Whether this contest is partisan.',
              allowNull: false,
              defaultValue: true
            },
            question: {
              type: Sequelize.BOOLEAN(),
              description:
                'Whether this contest is a question (ballot measure).',
              allowNull: false,
              defaultValue: false
            },
            questionTitle: {
              type: Sequelize.STRING(256),
              description: 'The title of the question.'
            },
            questionText: {
              type: Sequelize.TEXT(),
              description: 'The full text of the question.'
            },
            voteType: {
              type: Sequelize.ENUM(
                'majority',
                'ranked-choice',
                'run-off',
                'other'
              ),
              description: 'How this contest gets tallied up.',
              allowNull: false,
              defaultValue: 'majority'
            },
            reporting: {
              type: Sequelize.INTEGER(),
              description:
                'The number of precinct reporting, use NULL for unknown.'
            },
            totalPrecincts: {
              type: Sequelize.INTEGER(),
              description:
                'The total number of precincts, use NULL for unknown.'
            },
            // Maybe this should be determined from candidate votes?
            totalVotes: {
              type: Sequelize.INTEGER(),
              description: 'The total number of votes cast.'
            },
            subContest: {
              type: Sequelize.BOOLEAN(),
              description:
                'If this is a sub contest (i.e. a contest that is in a smaller boundary) or not.',
              defaultValue: false
            }
          })
        )
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(
        utils.addNameIndexes([
          { fields: ['localId'] },
          { fields: ['apId'] },
          { fields: ['elect'] },
          { fields: ['uncontested'] },
          { fields: ['partisan'] },
          { fields: ['question'] },
          { fields: ['questionTitle'] },
          { fields: ['voteType'] },
          { fields: ['reporting'] },
          { fields: ['totalPrecincts'] }
        ])
      )
    }
  );

  // Associate
  model.associate = function({
    Election,
    Office,
    Party,
    BoundaryVersion,
    Division,
    Result
  }) {
    this.__associations = [];

    // Make an association back to results
    this.__associations.push(this.hasMany(Result));

    // A contest is tied to an election
    this.__associations.push(
      this.belongsTo(Election, {
        foreignKey: { allowNull: false }
      })
    );

    // A contest can be associated with an office, but for instance,
    // a question is not.
    this.__associations.push(
      this.belongsTo(Office, {
        foreignKey: { allowNull: true }
      })
    );

    // A contest can have a party tied to it if it is
    // a primary
    this.__associations.push(
      this.belongsTo(Party, {
        foreignKey: { allowNull: true }
      })
    );

    // A contest can be a subcontest of another and tied to a specific
    // boundary and division
    this.__associations.push(this.belongsTo(this, { as: 'parent' }));
    this.__associations.push(this.belongsTo(BoundaryVersion));
    this.__associations.push(this.belongsTo(Division));
  };

  return model;
};
