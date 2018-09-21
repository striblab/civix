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
const { download } = require('../../lib/download.js');

// Import function
module.exports = async function coreDataTigerStatesImporter({
  logger,
  models,
  db
}) {
  logger('info', 'Census TIGER: States importer ...');
  logger(
    'info',
    'Downloading shapefile, can take a moment if not already cached ...'
  );

  // Get file
  let dl = await download({
    ttl: 1000 * 60 * 60 * 24 * 30,
    url:
      'https://www2.census.gov/geo/tiger/TIGER2017/STATE/tl_2017_us_state.zip',
    output: 'tl_2017_us_state'
  });

  // Read in the shapefile and repoject
  let states = await getShapes(path.join(dl.output, 'tl_2017_us_state.shp'));

  // Start transaction
  const transaction = await db.sequelize.transaction();

  try {
    // Import states
    let results = await importStates({
      states,
      db,
      transaction,
      models
    });

    // Log changes
    _.filter(results).forEach(u => {
      if (!u || !u[0]) {
        return;
      }

      logger(
        'info',
        `[${u[0].constructor.name}] ${u[1] ? 'Created' : 'Existed'}: ${
          u[0].dataValues.id
        }`
      );
    });

    // Commit
    transaction.commit();
    logger('info', 'Transaction committed.');
  }
  catch (error) {
    transaction.rollback();
    logger('error', 'Transaction rolled back; no data changes were made.');
    logger('error', error.stack ? error.stack : error);
  }
};

// Get shapes
async function getShapes(file) {
  return new Promise((resolve, reject) => {
    let collected = [];

    shapefile
      .open(file)
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
function importStates({ states, db, transaction, models }) {
  return Promise.all(
    states.map(s => {
      let p = s.properties;
      let boundaryId = `state-${p.STUSPS.toLowerCase()}`;
      let boundaryVersionId = `2018-modern-${boundaryId}`;

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
            shortTitle: p.STUSPS,
            sort: p.NAME.toLowerCase(),
            localId: p.STUSPS,
            parent_id: 'country-usa',
            division_id: 'state',
            sourceData: {
              'census-tiger-states': {
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
              geoid: p.GEOID,
              // Random date that is far enough back to include our probable
              // data set
              start: new Date('1980-01-01'),
              end: null,
              geometry: s.geometry,
              boundary_id: b[0].get('id'),
              sourceData: {
                'census-tiger-states': {
                  properties: p,
                  url:
                    'https://www.census.gov/cgi-bin/geo/shapefiles/index.php?year=2017&layergroup=States+%28and+equivalent%29'
                }
              }
            }
          });
        });
    })
  );
}
