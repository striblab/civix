/**
 * Importer for core data: Boundary: USA
 *
 * Geospatial: TODO
 */

// Dependencies
const _ = require('lodash');
const ensureManualSource = require('./source-manual.js');

// Import function
module.exports = async function coreDataDivisionsImporter({
  logger,
  models,
  db
}) {
  logger('info', 'Core data: Boundary: USA importer...');
  let updates = [];

  // Common include for source data
  const include = [
    {
      model: models.SourceData,
      as: 'source_data',
      include: {
        model: models.Source
      }
    }
  ];

  // Wrap in transaction
  return db.sequelize
    .transaction({}, t => {
      // Start promise chain
      return ensureManualSource({ models, transaction: t }).then(source => {
        updates = updates.concat([source]);

        // Create top level boundary
        return models.Boundary.findOrCreate({
          where: { id: 'usa' },
          transaction: t,
          include,
          defaults: {
            id: 'usa',
            name: 'usa',
            title: 'United States of America',
            sort: 'united states of america',
            division_id: 'country',
            source_data: [
              {
                id: 'core-data-boundary-country-usa',
                data: {
                  manual: true
                },
                source_id: source[0].dataValues.id
              }
            ]
          }
        }).then(results => {
          updates = updates.concat([results]);

          // Make sure we have core boundary
          if (!results[0]) {
            throw new Error('Unable to find core boundary.');
          }

          // Add Boundary version record
          return models.BoundaryVersion.findOrCreate({
            where: { id: 'modern-usa' },
            transaction: t,
            include,
            defaults: {
              id: 'modern-usa',
              name: 'modern-usa',
              boundary_id: 'usa',
              localId: null,
              fips: null,
              start: new Date('1959-08-21'),
              end: null,
              source_data: [
                {
                  id: 'core-data-boundary-country-usa-modern',
                  data: {
                    manual: true
                  },
                  source_id: source[0].dataValues.id
                }
              ]
            }
          }).then(results => {
            updates = updates.concat([results]);
          });
        });
      });
    })
    .then(results => {
      updates.forEach(u => {
        logger(
          'info',
          `[${u[0].constructor.name}] ${u[1] ? 'Created' : 'Existed'}: ${
            u[0].dataValues.id
          }`
        );
      });
    })
    .catch(error => {
      logger('error', 'Transaction rolled back; no data changes were made.');
      logger('error', error.stack ? error.stack : error);
    });
};
