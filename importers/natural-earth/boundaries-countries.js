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
const { importRecords, processGeo } = require('../../lib/importing.js');

// Import function
module.exports = async function coreDataTigerStatesImporter({
  logger,
  models,
  db,
  argv
}) {
  logger('info', 'Natural Earth: Countries ...');
  logger(
    'info',
    'Downloading shapefile, can take a moment if not already cached ...'
  );

  // Get districts from download
  let countries = await processGeo({
    url:
      'https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_admin_0_countries_lakes.zip',
    outputName: 'ne_10m_admin_0_countries_lakes',
    shapePath: 'ne_10m_admin_0_countries_lakes.shp',
    inputProjection: 'EPSG:4269',
    // Make sure there is a country code
    filter: c => {
      return c && c.properties && c.properties.ADM0_A3;
    },
    logger
  });

  // Make records
  let records = [];
  for (let s of countries.features) {
    let p = s.properties;
    let boundaryId = `country-${p.ADM0_A3.toLowerCase()}`;
    let boundaryVersionId = `2018-modern-${boundaryId}`;

    // Create general boundary if needed
    let boundary = {
      model: models.Boundary,
      record: {
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
    };
    records.push(boundary);

    // Create specific version boundary
    let boundaryVersion = {
      model: models.BoundaryVersion,
      record: {
        id: boundaryVersionId,
        name: boundaryVersionId,
        localId: p.ADM0_A3.toLowerCase(),
        fips: null,
        // Random date that is far enough back to include our probable
        // data set.  Use strings for postgres/sequelize dateonly
        start: '1980-01-01',
        end: null,
        geometry: s.geometry,
        boundary_id: boundaryId,
        sourceData: {
          'natural-earth-countries': {
            url:
              'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/',
            data: p
          }
        }
      }
    };
    records.push(boundaryVersion);
  }

  // Import records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
