/**
 * Importer for core data: Boundary: States
 *
 * From Census Tiger Lines file: https://www.census.gov/geo/maps-data/data/cbf/cbf_state.html
 */

// Dependencies
const { makeSort } = require('../../lib/strings.js');
const { importRecords, processGeo } = require('../../lib/importing.js');

// Import function
module.exports = async function tigerStatesImporter({
  logger,
  models,
  db,
  argv
}) {
  // Collect records to save
  let records = [];

  // Download
  let districts = await processGeo({
    url:
      'https://www2.census.gov/geo/tiger/TIGER2018/STATE/tl_2018_us_state.zip',
    shapePath: 'tl_2018_us_state.shp',
    inputProjection: 'EPSG:4269',
    logger
  });

  // Go through districts
  for (let district of districts.features) {
    let p = district.properties;
    let boundaryId = `usa-state-${p.STUSPS.toLowerCase()}`;
    let boundaryVersionId = `2017-${boundaryId}`;

    // Boundary
    let boundary = {
      model: models.Boundary,
      record: {
        id: boundaryId,
        name: boundaryId,
        title: p.NAME,
        shortTitle: p.STUSPS,
        sort: makeSort(p.NAME.toLowerCase()),
        localId: p.STUSPS.toLowerCase(),
        division_id: 'state',
        sourceData: {
          'census-tiger-states': {
            about: 'Civix importer, see specific version for original data.',
            url: 'https://www.census.gov/geo/maps-data/data/tiger-line.html'
          }
        }
      },
      post: async (r, { transaction }) => {
        await r[0].addParents(['country-usa'], { transaction });
        return r;
      }
    };
    records.push(boundary);

    // Boundary version
    let boundaryVersion = {
      model: models.BoundaryVersion,
      record: {
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
        geometry: district.geometry,
        boundary_id: boundaryId,
        sourceData: {
          'census-tiger-states': {
            properties: p,
            url: 'https://www.census.gov/geo/maps-data/data/tiger-line.html'
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
