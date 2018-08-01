/**
 * Office model.
 *
 * An office is an elected office.
 */

// Dependencies
const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'office',
    utils.snakeCaseFields(
      utils.extendWithSourceData(
        utils.extendWithNotes(
          utils.extendWithNames({
            seatName: {
              type: Sequelize.STRING(256),
              description: 'The name of the seat, such as "A" or "B".'
            }
          })
        )
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(
        utils.addNameIndexes([{ fields: ['seatName'] }])
      )
    }
  );

  // Associate
  model.associate = function({ Boundary, Body, Election, Source }) {
    this.__associations = [];

    // Tied to a boundary
    this.__associations.push(
      this.belongsTo(Boundary, {
        foreignKey: { allowNull: false }
      })
    );

    // Possibly tied to a body
    this.__associations.push(this.belongsTo(Body));

    // // An office has many elections
    // this.__associations.push(
    //   this.belongsToMany(Election, {
    //     through: 'offices_elections',
    //     underscore: true,
    //     foreignKey: { allowNull: false }
    //   })
    // );

    // Add source fields
    utils.extendWithSources(this, Source);
  };

  return model;
};
