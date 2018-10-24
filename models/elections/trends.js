/**
 * Trends model.
 *
 * Describes a trend such as a balance of power in a body,
 * modeled after the AP trends data.
 */

// Dependencies
const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'trend',
    utils.snakeCaseFields(
      utils.extendWithNotes(
        utils.extendWithSourceData(
          utils.extendWithNames({
            won: {
              type: Sequelize.INTEGER(),
              description: 'Number of winners.'
            },
            leading: {
              type: Sequelize.INTEGER(),
              description: 'Leading.'
            },
            holdovers: {
              type: Sequelize.INTEGER(),
              description: 'Holdovers.'
            },
            winningTrend: {
              type: Sequelize.INTEGER(),
              description: 'Winning trend number.'
            },
            current: {
              type: Sequelize.INTEGER(),
              description: 'Current.'
            },
            insufficientVote: {
              type: Sequelize.INTEGER(),
              description: 'Insufficent votes.'
            },
            netWinners: {
              type: Sequelize.INTEGER(),
              description: 'Net winners.'
            },
            netLeaders: {
              type: Sequelize.INTEGER(),
              description: 'Net leaders.'
            }
          })
        )
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(
        utils.addNameIndexes([
          { fields: ['won'] },
          { fields: ['leading'] },
          { fields: ['holdovers'] },
          { fields: ['winningTrend'] },
          { fields: ['current'] },
          { fields: ['insufficientVote'] },
          { fields: ['netWinners'] },
          { fields: ['netLeaders'] }
        ])
      )
    }
  );

  // Associate
  model.associate = function({ Party, Body, Election }) {
    this.__associations = [];

    // Tied to an election
    this.__associations.push(
      this.belongsTo(Election, {
        foreignKey: { allowNull: false }
      })
    );

    // Each row is for a party
    this.__associations.push(
      this.belongsTo(Party, {
        foreignKey: { allowNull: false }
      })
    );

    // Is tied to a body
    this.__associations.push(
      this.belongsTo(Body, {
        foreignKey: { allowNull: false }
      })
    );
  };

  return model;
};
