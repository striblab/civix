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
    'election',
    utils.snakeCaseFields(
      utils.extendWithSourceData(
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
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(
        utils.addNameIndexes([
          { fields: ['date'] },
          { fields: ['type'] },
          { unique: true, fields: ['date', 'type', 'BoundaryId'] }
        ])
      )
    }
  );

  // Associate
  model.associate = function({ BoundaryVersion, Source }) {
    this.__associations = [];

    // Election has a boundary
    this.__associations.push(
      this.belongsTo(BoundaryVersion, {
        foreignKey: { allowNull: false }
      })
    );

    // Add source fields
    utils.extendWithSources(this, Source);
  };

  return model;
};
