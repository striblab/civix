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
            area: {
              type: Sequelize.STRING(256),
              description:
                'Describes the area that this office is for.  Overall this repeats the boundary information.'
            },
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
        utils.addNameIndexes([{ fields: ['seatName'] }, { fields: ['area'] }])
      )
    }
  );

  // Associate
  model.associate = function({ Boundary, Body, Contest, Source }) {
    this.__associations = [];

    // Tied to a boundary
    this.__associations.push(
      this.belongsTo(Boundary, {
        foreignKey: { allowNull: false }
      })
    );

    // Possibly tied to a body
    this.__associations.push(this.belongsTo(Body));

    // Make an association back to contests
    this.__associations.push(this.hasMany(Contest));

    // Add source fields
    utils.extendWithSources(this, Source);
  };

  return model;
};
