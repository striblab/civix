/**
 * Elections model.
 *
 * An Election describes a day where there are elections.  Jurisdiction
 * is the largest jurisidction that is having elections,
 * probably the US, or a state, but may be a specific county.
 */

// Dependencies
const Sequelize = require('sequelize');
const Election = require('./election.js');
const Office = require('../government/office.js');
const config = require('../../config');
const sources = require('../sources');
const utils = require('../model-utils.js');

// Model
const Contest = config.db.define(
  'contest',
  utils.snakeCaseFields(
    utils.extendWithNotes(
      utils.extendWithNames({
        type: {
          type: Sequelize.ENUM('general', 'primary', 'special'),
          description:
            'The type of the election for this specific contest; overriding the election value.',
          allowNull: true
        },
        seats: {
          type: Sequelize.INTEGER(),
          description: 'The number of seats being elected.',
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
          description: 'Whether this contest is a question (ballot measure).',
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
          type: Sequelize.ENUM('majority', 'ranked-choice', 'run-off', 'other'),
          description: 'How this contest gets tallied up.',
          allowNull: false,
          defaultValue: 'majority'
        },
        reporting: {
          type: Sequelize.INTEGER(),
          description: 'The number of precinct reporting, use NULL for unknown.'
        },
        totalPrecincts: {
          type: Sequelize.INTEGER(),
          description: 'The total number of precincts, use NULL for unknown.'
        },
        // Maybe this should be determined from candidate votes?
        totalVotes: {
          type: Sequelize.INTEGER(),
          description: 'The total number of votes cast.'
        }
      })
    )
  ),
  {
    underscored: true,
    indexes: utils.snakeCaseIndexes(
      utils.addNameIndexes([
        { fields: ['seats'] },
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

// A contest is tied to an election
Contest.belongsTo(Election);

// A contest is tied to an office
Contest.belongsTo(Office);

// Add source fields
utils.extendWithSources(Contest, sources);

module.exports = Contest;