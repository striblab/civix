/**
 * Office model.
 *
 * An office is an elected office.
 */

// Dependencies
const Sequelize = require('sequelize');
const Jurisdiction = require('../jurisdictions/jurisdiction.js');
const Election = require('../elections/election.js');
const Body = require('./body.js');
const config = require('../../config');
const sources = require('../sources');
const utils = require('../model-utils.js');

// Model
const Office = config.db.define(
  'office',
  utils.snakeCaseFields(
    utils.extendWithNotes(
      utils.extendWithNames({
        date: {
          type: Sequelize.DATEONLY(),
          description: 'The date of the election',
          allowNull: false
        },
        type: {
          type: Sequelize.ENUM('general', 'primary', 'special'),
          description: 'The type of the election.',
          defaultValue: 'general',
          allowNull: false
        }
      })
    )
  ),
  {
    underscored: true,
    indexes: utils.snakeCaseIndexes(
      utils.addNameIndexes([{ fields: ['date'] }, { fields: ['type'] }])
    )
  }
);

// Tied to a jurisdiction
Office.belongsTo(Jurisdiction);

// Possibly tied to a body
Office.belongsTo(Body);

// An office has many elections
Office.belongsToMany(Election, {
  through: 'offices_elections',
  underscore: true
});

// Add source fields
utils.extendWithSources(Office, sources);

module.exports = Office;
