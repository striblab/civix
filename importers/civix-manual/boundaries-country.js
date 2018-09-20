/**
 * Importer for core data: Boundary: USA
 *
 * Geospatial: TODO
 */

// Dependencies
const _ = require('lodash');
const ensureManualSource = require('./source-manual.js');

// Import function
module.exports = async function coreDataCountryImporter({
  logger,
  models,
  db
}) {
  logger('info', 'Core data: Boundary: USA importer...');
  let updates = [];

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
          include: models.Boundary__associations,
          defaults: {
            id: 'usa',
            name: 'usa',
            title: 'United States of America',
            shortTitle: 'U.S.A.',
            sort: 'united states of america',
            division_id: 'country',
            sourceData: {
              [source[0].get('id')]: {
                manual: true
              }
            }
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
            include: models.BoundaryVersion.__associations,
            defaults: {
              id: 'modern-usa',
              name: 'modern-usa',
              boundary_id: 'usa',
              localId: null,
              fips: null,
              start: new Date('1959-08-21'),
              end: null,
              sourceData: {
                [source[0].get('id')]: {
                  manual: true
                }
              }
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
