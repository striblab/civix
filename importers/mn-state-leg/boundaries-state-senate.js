/**
 * Minnesota state legislature: State senate districts
 *
 * From:
 * https://www.gis.leg.mn/html/download.html
 */

// Dependencies
const moment = require('moment');
const { makeSort } = require('../../lib/strings.js');
const { importRecords, processGeo } = require('../../lib/importing.js');

// Import function
module.exports = async function mnStateLegStateSenateImporter({
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

  // Find info about districts
  let districtSet = districtSets()[argv.year];
  if (!districtSet) {
    throw new Error(
      `Unable to find information about District set ${argv.year}`
    );
  }
  districtSet.year = argv.year;

  // Log
  logger('info', `MN State Leg: State senate ${argv.year} ...`);

  // Get geo
  let districts = await processGeo({
    url: districtSet.url,
    outputName: districtSet.output,
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
    let boundaryId = `usa-mn-state-upper-${parsed.geoid}`;
    let boundaryVersionId = `${districtSet.start.year()}-${boundaryId}`;
    let title = `Minnesota State Senate District ${parsed.localId.replace(
      /^0+/,
      ''
    )}`;

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
        title: title,
        shortTitle: `District ${parsed.localId.replace(/^0+/, '')}`,
        sort: makeSort(title),
        localId: parsed.localId,
        division_id: 'state-upper',
        sourceData: {
          'mn-state-leg': {
            about: 'See specific version for original data.',
            url: 'https://www.gis.leg.mn/html/download.html'
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
        geoid: parsed.geoid,
        // Use date strings so that Sequelize/postgres doesn't get
        // offset by timezones
        start: districtSet.start.format('YYYY-MM-DD'),
        end: districtSet.end.format('YYYY-MM-DD'),
        geometry: district.geometry,
        boundary_id: boundaryId,
        sourceData: {
          'mn-state-leg': {
            url: 'https://www.gis.leg.mn/html/download.html',
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
    return {
      localId: (input.DISTRICT || input.SENDIST).padStart(2, '0'),
      geoid: `27${(input.DISTRICT || input.SENDIST).padStart(2, '0')}`
    };
  };

  return {
    2012: {
      url:
        'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/senate/S2012',
      output: 'mn-state-senate-2012.geo.json',
      start: moment('2012-01-01'),
      end: moment('2021-12-31'),
      parser: defaultParser
    },
    2002: {
      url:
        'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/senate/S2002',
      output: 'mn-state-senate-2002.geo.json',
      start: moment('2002-01-01'),
      end: moment('2011-12-31'),
      parser: defaultParser
    },
    1994: {
      url:
        'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/senate/S1994',
      output: 'mn-state-senate-1994.geo.json',
      start: moment('1994-01-01'),
      end: moment('2001-12-31'),
      parser: defaultParser
    }
  };
}
