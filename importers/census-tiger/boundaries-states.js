/**
 * Importer for core data: Boundary: States
 *
 * From Census Tiger Lines file: https://www.census.gov/geo/maps-data/data/cbf/cbf_state.html
 */

// Dependencies
const _ = require('lodash');
const path = require('path');
const { shapes } = require('../../lib/shapefile.js');
const { makeSort } = require('../../lib/strings.js');
const { download } = require('../../lib/download.js');

// Import function
module.exports = async function tigerStatesImporter({ logger, models, db }) {
  logger('info', 'Census TIGER: States importer ...');
  logger(
    'info',
    'Downloading shapefile, can take a moment if not already cached ...'
  );

  // Get file
  let dl = await download({
    ttl: 1000 * 60 * 60 * 24 * 30,
    url:
      'http://www2.census.gov/geo/tiger/GENZ2017/shp/cb_2017_us_state_500k.zip',
    output: 'cb_2017_us_state_500k'
  });

  // Read in the shapefile and repoject
  let states = await shapes(path.join(dl.output, 'cb_2017_us_state_500k.shp'), {
    originalProjection: 'EPSG:4269'
  });

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

// Import states
async function importStates({ states, db, transaction, models }) {
  let results = [];

  for (let s of states) {
    let p = s.properties;
    let boundaryId = `usa-state-${p.STUSPS.toLowerCase()}`;
    let boundaryVersionId = `2017-${boundaryId}`;

    // Boundary
    let boundary = await db.findOrCreateOne(models.Boundary, {
      transaction,
      where: { id: boundaryId },
      include: models.Boundary.__associations,
      defaults: {
        id: boundaryId,
        name: boundaryId,
        title: p.NAME,
        shortTitle: p.STUSPS,
        sort: makeSort(p.NAME.toLowerCase()),
        localId: p.STUSPS.toLowerCase(),
        parent_id: 'country-usa',
        division_id: 'state',
        sourceData: {
          'census-tiger-states': {
            about: 'Civix importer, see specific version for original data.',
            url: 'https://www.census.gov/geo/maps-data/data/cbf/cbf_state.html'
          }
        }
      }
    });

    // Boundary version
    let boundaryVersion = await db.findOrCreateOne(models.BoundaryVersion, {
      transaction,
      where: { id: boundaryVersionId },
      include: models.BoundaryVersion.__associations,
      defaults: {
        id: boundaryVersionId,
        name: boundaryVersionId,
        localId: p.STUSPS,
        fips: p.STATEFP,
        geoid: p.GEOID,
        affgeoid: p.AFFGEOID,
        // Random date that is far enough back to include our probable
        // data set
        start: new Date('1980-01-01'),
        end: null,
        geometry: s.geometry,
        boundary_id: boundaryId,
        sourceData: {
          'census-tiger-states': {
            properties: p,
            url: 'https://www.census.gov/geo/maps-data/data/cbf/cbf_state.html'
          }
        }
      }
    });

    results = results.concat([boundary, boundaryVersion]);
  }

  return results;
}
