/**
 * Office model.
 *
 * An office is an elected office.
 */

// Dependencies
//const Sequelize = require('sequelize');
const utils = require('../model-utils.js');

// Model
module.exports = db => {
  let model = db.define(
    'office',
    utils.snakeCaseFields(
      utils.extendWithNotes(
        utils.extendWithNames({
          // Fields?
        })
      )
    ),
    {
      underscored: true,
      indexes: utils.snakeCaseIndexes(utils.addNameIndexes([]))
    }
  );

  // Associate
  model.associate = function({ Jurisdiction, Body, Election, SourceData }) {
    // Tied to a jurisdiction
    this.belongsTo(Jurisdiction, {
      foreignKey: { allowNull: false }
    });

    // Possibly tied to a body
    this.belongsTo(Body);

    // An office has many elections
    this.belongsToMany(Election, {
      through: 'offices_elections',
      underscore: true,
      foreignKey: { allowNull: false }
    });

    // Add source fields
    utils.extendWithSources(this, SourceData);
  };

  return model;
};
