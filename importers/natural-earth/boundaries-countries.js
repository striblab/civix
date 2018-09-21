/**
 * Importer from Natural Earth: countries
 *
 * From:
 * https://www.naturalearthdata.com/downloads/10m-cultural-vectors/
 *
 * Specifically:
 * https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_admin_0_countries_lakes.zip
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
  logger('info', 'Natural Earth: Countries ...');
  logger(
    'info',
    'Downloading shapefile, can take a moment if not already cached ...'
  );

  // Get file
  let dl = await download({
    ttl: 1000 * 60 * 60 * 24 * 30,
    url:
      'https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_admin_0_countries_lakes.zip',
    output: 'ne_10m_admin_0_countries_lakes'
  });

  // Read in the shapefile and repoject
  let countries = await getShapes(
    path.join(dl.output, 'ne_10m_admin_0_countries_lakes.shp')
  );

  // Start transaction
  const transaction = await db.sequelize.transaction();

  try {
    // Import states
    let results = await importCountries({
      countries,
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
function importCountries({ countries, db, transaction, models }) {
  // Make sure there is a country code
  countries = _.filter(countries, c => {
    return c && c.properties && c.properties.ADM0_A3;
  });

  return Promise.all(
    countries.map(s => {
      let p = s.properties;
      let boundaryId = `country-${p.ADM0_A3.toLowerCase()}`;
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
            title: p.NAME_LONG,
            shortTitle: p.NAME,
            sort: p.NAME_SORT
              ? p.NAME_SORT.toLowerCase()
              : p.NAME_LONG.toLowerCase(),
            localId: p.ADM0_A3.toLowerCase(),
            division_id: 'country',
            sourceData: {
              'natural-earth-countries': {
                url:
                  'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/',
                about: 'See specific version for original data.'
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
              localId: p.ADM0_A3.toLowerCase(),
              fips: null,
              // Random date that is far enough back to include our probable
              // data set
              start: new Date('1980-01-01'),
              end: null,
              geometry: s.geometry,
              boundary_id: b[0].get('id'),
              sourceData: {
                'natural-earth-countries': {
                  url:
                    'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/',
                  data: p
                }
              }
            }
          });
        });
    })
  );
}
