/**
 * Importer for core data: Boundary: States
 *
 * From Census Tiger Lines file: https://www.census.gov/cgi-bin/geo/shapefiles/index.php?year=2017&layergroup=States+%28and+equivalent%29
 */

// Dependencies
const _ = require('lodash');
const path = require('path');
const shapefile = require('shapefile');
const reproject = require('reproject');
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

        return getShapes().then(states => {
          return importStates({
            states,
            db,
            transaction: t,
            models,
            source: tigerSource[0]
          }).then(results => {
            updates = updates.concat(results);
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
        source.read().then(function collect(result) {
          if (result.done) {
            return resolve(collected);
          }
          // Reproject and add CRS
          let r = reproject.reproject(result.value, 'EPSG:4269', 'EPSG:4326');
          r.geometry.crs = { type: 'name', properties: { name: 'EPSG:4326' } };

          // Needs to be MultiPolygon
          if (r.geometry.type === 'Polygon') {
            r.geometry.type = 'MultiPolygon';
            r.geometry.coordinates = [r.geometry.coordinates];
          }

          collected.push(r);
          return source.read().then(collect);
        })
      )
      .catch(reject);
  });
}

// Import states
function importStates({ states, db, transaction, models, source }) {
  return Promise.all(
    states.map(s => {
      let p = s.properties;
      let boundaryId = `state-${p.STUSPS}`;
      let boundaryVersionId = `modern-state-${p.STUSPS}`;

      // Create general boundary if needed
      return db
        .findOrCreateOne(models.Boundary, {
          transaction,
          where: { id: boundaryId },
          include: models.Boundary.__associations,
          defaults: {
            id: boundaryId,
            name: boundaryId,
            title: p.NAME,
            localId: p.STUSPS,
            parent_id: 'usa',
            division_id: 'state',
            sourceData: {
              [source.get('id')]: {
                about: 'Civix importer, see specific version for original data.'
              }
            }
          }
        })
        .then(b => {
          // Create specific version boundary
          return db.findOrCreateOne(models.BoundaryVersion, {
            transaction,
            where: { id: boundaryVersionId },
            include: models.BoundaryVersion.__associations,
            defaults: {
              id: boundaryVersionId,
              name: boundaryVersionId,
              localId: p.STUSPS,
              fips: p.STATEFP,
              // Random date that is far enough back to include our probable
              // data set
              start: new Date('1980-01-01'),
              end: null,
              geometry: s.geometry,
              boundary_id: b[0].get('id'),
              sourceData: {
                [source.get('id')]: {
                  properties: p
                }
              }
            }
          });
        });
    })
  );
}
