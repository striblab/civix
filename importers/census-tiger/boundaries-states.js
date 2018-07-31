/**
 * Importer for core data: Boundary: States
 *
 * From Census Tiger Lines file: https://www.census.gov/cgi-bin/geo/shapefiles/index.php?year=2017&layergroup=States+%28and+equivalent%29
 */

// Dependencies
const _ = require('lodash');
const path = require('path');
const shapefile = require('shapefile');
const ensureTigerSource = require('./source-census-tiger-lines.js');

// Import function
module.exports = async function coreDataDivisionsImporter({
  logger,
  models,
  db
}) {
  logger('info', 'Core data: Boundary: States importer...');
  let updates = [];

  // Wrap in transaction
  return db.sequelize
    .transaction({}, t => {
      // Start promise chain
      return ensureTigerSource({ models, transaction: t }).then(tigerSource => {
        updates = updates.concat([tigerSource]);

        getShapes().then(states => {
          console.log(states);
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

// Get shapes
function getShapes() {
  return new Promise((resolve, reject) => {
    let collected = [];

    shapefile
      .open(
        path.join(
          __dirname,
          'data',
          'boundaries-states',
          'tl_2017_us_state',
          'tl_2017_us_state.shp'
        )
      )
      .then(source =>
        source.read().then(function log(result) {
          if (result.done) {
            return resolve(collected);
          }
          collected.push(result.value);
          return source.read().then(log);
        })
      )
      .catch(reject);
  });
}

// // Create top level boundary
// return models.Boundary.findOrCreate({
//   where: { id: 'usa' },
//   transaction: t,
//   include,
//   defaults: {
//     id: 'usa',
//     name: 'usa',
//     title: 'United States of America',
//     sort: 'united states of america',
//     division_id: 'country',
//     source_data: [
//       {
//         id: 'core-data-boundary-country-usa',
//         data: {
//           manual: true
//         },
//         source_id: source[0].dataValues.id
//       }
//     ]
//   }
// }).then(results => {
//   updates = updates.concat([results]);

//   // Make sure we have core boundary
//   if (!results[0]) {
//     throw new Error('Unable to find core boundary.');
//   }

//   // Add Boundary version record
//   return models.BoundaryVersion.findOrCreate({
//     where: { id: 'modern-usa' },
//     transaction: t,
//     include,
//     defaults: {
//       id: 'modern-usa',
//       name: 'modern-usa',
//       boundary_id: 'usa',
//       localId: null,
//       fips: null,
//       start: new Date('1959-08-21'),
//       end: null,
//       source_data: [
//         {
//           id: 'core-data-boundary-country-usa-modern',
//           data: {
//             manual: true
//           },
//           source_id: source[0].dataValues.id
//         }
//       ]
//     }
//   }).then(results => {
//     updates = updates.concat([results]);
//   });
// });
