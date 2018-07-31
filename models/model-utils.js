/**
 * Add some common fields to models
 */

// Dependencies
const _ = require('lodash');
const Sequelize = require('sequelize');

// Underscore fields
function snakeCaseFields(fields = {}) {
  return _.mapValues(fields, (f, i) => {
    f.field = f.field ? f.field : _.snakeCase(i);
    return f;
  });
}

// Extend with id, name, title
function extendWithNames(fields = {}) {
  return _.extend(
    {
      id: {
        type: Sequelize.STRING(128),
        primaryKey: true,
        description: 'The string ID.'
      },
      name: {
        type: Sequelize.STRING(128),
        description: 'The human-discernable name identifier (slug).',
        allowNull: false,
        unique: true
      },
      title: {
        type: Sequelize.STRING(256),
        description: 'The formatted title used for publication.',
        allowNull: false
      },
      sort: {
        type: Sequelize.STRING(256),
        description:
          'The title to use for sorting, useful for adding leading zeros or removing articles.'
      }
    },
    fields
  );
}

// Extend with source data
function extendWithSourceData(fields = {}) {
  return _.extend(fields, {
    sourceData: {
      type: Sequelize.JSON(),
      description:
        'General place to put original source information.  Ideally, use the Source ID as the key in the JSON.',
      allowNull: false
    }
  });
}

// Add indexes for name
function addNameIndexes(indexes = []) {
  return indexes.concat([
    { fields: ['name'] },
    { fields: ['title'] },
    { fields: ['sort'] }
  ]);
}

// Extend with notes
function extendWithNotes(fields = {}) {
  return _.extend(fields, {
    notes: {
      type: Sequelize.TEXT(),
      description: 'Any notes that may show up in publication.'
    },
    internalNotes: {
      type: Sequelize.TEXT(),
      description: 'Any internal notes for the source.'
    }
  });
}

// Extend with source
function extendWithSources(model, Source) {
  // !!! Can;t seem to get m-m include/associations to work
  // with findOrCreate so, giving up on this for
  // now.
  return model;

  // // Allow a model to have multiple sources
  // model.belongsToMany(Source, {
  //   as: 'sources',
  //   through: `${model.options.name.plural}_sources`,
  //   underscored: true
  // });
  // return model;
}

// Sequelize doesn't seem to use the field name for a field in indexes
function snakeCaseIndexes(indexes = []) {
  return indexes.map(i => {
    if (i && i.fields && _.isArray(i.fields)) {
      i.fields = i.fields.map(_.snakeCase);
    }
    return i;
  });
}

// Export
module.exports = {
  extendWithNames,
  extendWithSourceData,
  addNameIndexes,
  extendWithNotes,
  extendWithSources,
  snakeCaseFields,
  snakeCaseIndexes
};
