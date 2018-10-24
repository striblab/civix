/**
 * Trends model.
 *
 * Describes a trend such as a balance of power in a body,
 * modeled after the AP trends data.
 * http://customersupport.ap.org/doc/AP_Elections_API_Developer_Guide.pdf
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
              description:
                'The number of seats for each party that have been declared winners in the current election.'
            },
            leading: {
              type: Sequelize.INTEGER(),
              description:
                'The number of seats for each party that are currently leading but have not been declared winners.'
            },
            holdovers: {
              type: Sequelize.INTEGER(),
              description:
                'The number of Governor seats for each party that are not up for election in the current election.'
            },
            winningTrend: {
              type: Sequelize.INTEGER(),
              description: 'Party breakdown if present trend continues.'
            },
            current: {
              type: Sequelize.INTEGER(),
              description:
                'The total number of seats for the office for each party, before the current election.'
            },
            insufficientVote: {
              type: Sequelize.INTEGER(),
              description:
                'The number of seats for each party where the race is ignored in trend calculations. Races with fewer than 5% of precincts reporting, with less than 5% of registered voters having voted so far, and with no declared winner are considered to have insufficient votes. Uncalled, uncontested races are included as part of the Insufficient Vote.'
            },
            netWinners: {
              type: Sequelize.INTEGER(),
              description:
                'The number of seats that each party has won or lost in races where a winner has been declared.  Any races where a winner has not been declared are ignored in this calculation.'
            },
            netLeaders: {
              type: Sequelize.INTEGER(),
              description:
                'The number of seats that each party would win or lose in races where the winner has not been declared.  Races with insufficient votes are not included in Net Change Leaders.  Net Change Winners and Net Change Leaders may be added together to get net change trends, assuming that the leaders will become winners.'
            },
            test: {
              type: Sequelize.BOOLEAN(),
              description: 'Whether is test data.',
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
          { fields: ['won'] },
          { fields: ['leading'] },
          { fields: ['holdovers'] },
          { fields: ['winningTrend'] },
          { fields: ['current'] },
          { fields: ['insufficientVote'] },
          { fields: ['netWinners'] },
          { fields: ['netLeaders'] },
          { fields: ['test'] }
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
