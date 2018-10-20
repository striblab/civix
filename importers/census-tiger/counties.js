/**
 * Census TIGER: Congressional districts
 *
 * From:
 * https://www.census.gov/geo/maps-data/data/cbf/cbf_cds.html
 */

// Dependencies
const moment = require('moment');
const { makeSort } = require('../../lib/strings.js');
const { importRecords, processGeo } = require('../../lib/importing.js');

// Import function
module.exports = async function tigerCountiesImporter({
  logger,
  models,
  db,
  argv
}) {
  // Look for year from argv
  if (!argv.year) {
    throw new Error(
      'A year argument must be provided, for example "--year=2017"'
    );
  }

  // Find info about counties
  let countySet = countySets()[argv.year];
  if (!countySet) {
    throw new Error(`Unable to find information about County set ${argv.year}`);
  }
  countySet.year = argv.year;

  // Log
  logger('info', `Census TIGER: County set ${argv.year} ...`);

  // Collect records to save
  let records = [];

  // Download
  let districts = await processGeo({
    url: countySet.url,
    shapePath: countySet.shapefile,
    inputProjection: 'EPSG:4269',
    logger
  });

  // Go through districts
  for (let district of districts.features) {
    let p = district.properties;
    let parsed = countySet.parser(p, countySet);
    let boundaryId = `usa-county-${parsed.geoid}`;
    let boundaryVersionId = `${countySet.start.year()}-${boundaryId}`;

    // Get state
    let stateVersion = await models.BoundaryVersion.findOne({
      where: { geoid: parsed.state }
    });
    let state = await models.Boundary.findOne({
      where: { id: stateVersion.get('boundary_id') }
    });
    if (!state) {
      throw new Error(`Unable to find state with GEOID code: ${parsed.state}`);
    }

    // Create general boundary if needed
    let boundary = {
      model: models.Boundary,
      record: {
        id: boundaryId,
        name: boundaryId,
        title: `${parsed.name} County`,
        shortTitle: parsed.name,
        sort: makeSort(parsed.name),
        localId: parsed.geoid,
        division_id: 'county',
        sourceData: {
          'census-tiger-counties': {
            about: 'See specific version for original data.',
            url:
              'https://www.census.gov/geo/maps-data/data/cbf/cbf_counties.html'
          }
        }
      },
      post: async (r, { transaction }) => {
        await r[0].addParents([state.get('id')], { transaction });
        return r;
      }
    };
    records.push(boundary);

    // Create boundary version
    let boundaryVersion = {
      model: models.BoundaryVersion,
      record: {
        id: boundaryVersionId,
        name: boundaryVersionId,
        localId: parsed.localId,
        fips: parsed.fips,
        geoid: parsed.geoid,
        affgeoid: parsed.affgeoid,
        // Use date strings so that Sequelize/postgres doesn't get
        // offset by timezones
        start: countySet.start.format('YYYY-MM-DD'),
        end: countySet.end ? countySet.end.format('YYYY-MM-DD') : undefined,
        geometry: district.geometry,
        boundary_id: boundaryId,
        sourceData: {
          'census-tiger-counties': {
            url:
              'https://www.census.gov/geo/maps-data/data/cbf/cbf_counties.html',
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

// Processing each congress
function countySets() {
  let defaultParser = input => {
    return {
      localId: input.COUNTYFP,
      state: input.STATEFP,
      // The FIPS code is not unique across states
      fips: input.COUNTYFP,
      affgeoid: input.AFFGEOID,
      geoid: input.GEOID,
      name: input.NAME
    };
  };

  return {
    2018: {
      url:
        'https://www2.census.gov/geo/tiger/TIGER2018/COUNTY/tl_2018_us_county.zip',
      shapefile: 'tl_2018_us_county.shp',
      start: moment('2018-01-01'),
      end: null,
      parser: defaultParser
    },
    2017: {
      url:
        'https://www2.census.gov/geo/tiger/GENZ2017/shp/cb_2017_us_county_500k.zip',
      shapefile: 'cb_2017_us_county_500k.shp',
      start: moment('2017-01-01'),
      end: moment('2017-12-31'),
      parser: defaultParser
    }
  };
}
