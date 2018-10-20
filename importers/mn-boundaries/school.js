/**
 * Minnesota Geo Commons: School Districts
 *
 * From:
 * https://gisdata.mn.gov/dataset/bdry-school-district-boundaries
 */

// Dependencies
const moment = require('moment');
const { makeSort } = require('../../lib/strings.js');
const { importRecords, processGeo } = require('../../lib/importing.js');

// Import function
module.exports = async function mnBoundaries({ logger, models, db, argv }) {
  // Look for year from argv
  if (!argv.year) {
    throw new Error(
      'A year argument must be provided, for example "--year=2017"'
    );
  }

  // Find info about districts
  let districtSet = districtSets()[argv.year];
  if (!districtSet) {
    throw new Error(
      `Unable to find information about District set ${argv.year}`
    );
  }
  districtSet.year = argv.year;

  // Log
  logger('info', `MN Geo Commons: School Districts ${argv.year} ...`);

  // Get geo
  let districts = await processGeo({
    url: districtSet.url,
    shapePath: districtSet.shapePath,
    filter: districtSet.filter,
    group: districtSet.grouping,
    inputProjection: 'EPSG:26915',
    logger
  });

  // Records to collect
  let records = [];

  // Go through districts
  for (let district of districts.features) {
    let p = district.properties;
    let parsed = districtSet.parser(p, districtSet);
    let boundaryId = `usa-mn-school-${parsed.localId}`;
    let boundaryVersionId = `${districtSet.start.year()}-${boundaryId}`;

    // Get state
    let state = await models.Boundary.findOne({
      where: { localId: 'mn' }
    });
    if (!state) {
      throw new Error('Unable to find state with localId code: mn');
    }

    // Create general boundary if needed
    let boundary = {
      model: models.Boundary,
      record: {
        id: boundaryId,
        name: boundaryId,
        title: parsed.title,
        shortTitle: parsed.title,
        sort: makeSort(parsed.title),
        localId: parsed.localId.toLowerCase(),
        division_id: 'school',
        sourceData: {
          'mn-geo-commons': {
            about: 'See specific version for original data.',
            url:
              'https://gisdata.mn.gov/dataset/bdry-school-district-boundaries'
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
        localId: parsed.localId.toLowerCase(),
        geoid: parsed.geoid,
        // Use date strings so that Sequelize/postgres doesn't get
        // offset by timezones
        start: districtSet.start.format('YYYY-MM-DD'),
        end: districtSet.end.format('YYYY-MM-DD'),
        geometry: district.geometry,
        boundary_id: boundaryId,
        sourceData: {
          'mn-geo-commons': {
            url:
              'https://gisdata.mn.gov/dataset/bdry-school-district-boundaries',
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
function districtSets() {
  let defaultParser = input => {
    const n = input => {
      return input
        .toString()
        .replace(/,/g, '')
        .trim();
    };
    return {
      localId: `${n(input.UNI_TYP).padStart(2, '0')}-${n(
        input.UNI_MAJ
      ).padStart(4, '0')}`,
      title: input.UNI_NAM
    };
  };
  let defaultFilter = feature => {
    return (
      feature.properties &&
      feature.properties.UNI_TYP &&
      feature.properties.UNI_TYP !== '0'
    );
  };

  return {
    2017: {
      url:
        'ftp://ftp.gisdata.mn.gov/pub/gdrs/data/pub/us_mn_state_mde/bdry_school_district_boundaries/shp_bdry_school_district_boundaries.zip',
      shapePath: 'school_district_boundaries.shp',
      start: moment('2017-08-01'),
      end: moment('2018-07-30'),
      filter: defaultFilter,
      parser: defaultParser
    }
  };
}
