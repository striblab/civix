/**
 * Minnesota state legislature: Park Board
 *
 * From:
 * https://www.gis.leg.mn/html/download.html
 */

// Dependencies
const moment = require('moment');
const { makeSort } = require('../../lib/strings.js');
const { importRecords, processGeo } = require('../../lib/importing.js');

// Import function
module.exports = async function mnStateLegStateHouseImporter({
  logger,
  models,
  db,
  argv
}) {
  // Look for year from argv
  if (!argv.year) {
    throw new Error(
      'A year argument must be provided, for example "--year=2018"'
    );
  }

  // Find info about districts
  let districtSet = districtSets()[argv.year];
  if (!districtSet) {
    throw new Error(
      `Unable to find information about Park Board set ${argv.year}`
    );
  }
  districtSet.year = argv.year;

  // Log
  logger('info', `MN State Leg: Park Board ${argv.year} ...`);

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
    let boundaryId = `usa-mn-local-park-board-27${parsed.mcdFips.toLowerCase()}-${parsed.localId.toLowerCase()}`;
    let boundaryVersionId = `${districtSet.start.year()}-${boundaryId}`;
    let muncipalityId = `usa-mn-county-local-27${parsed.mcdFips.toLowerCase()}`;

    // Get munipcal
    let muncipality = await models.Boundary.findOne({
      where: { id: muncipalityId }
    });
    if (!muncipality) {
      throw new Error(`Unable to find muncipality with code: ${muncipalityId}`);
    }

    // Create general boundary if needed
    let boundary = {
      model: models.Boundary,
      record: {
        id: boundaryId,
        name: boundaryId,
        title: parsed.title,
        shortTitle: parsed.shortTitle,
        sort: makeSort(parsed.title),
        localId: parsed.localId.toLowerCase(),
        division_id: 'local-ward',
        sourceData: {
          'mn-state-leg': {
            about: 'See specific version for original data.',
            url: 'https://www.gis.leg.mn/html/download.html'
          }
        }
      },
      post: async (r, { transaction }) => {
        await r[0].addParents([muncipality.get('id')], {
          transaction
        });
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

// Processing each set of districts
function districtSets() {
  let defaultFilter = feature => {
    return (
      feature.properties.PARKDIST &&
      feature.properties.PARKDIST_N.match(/park.*board/i)
    );
  };
  let defaultGrouping = feature => {
    return `${feature.properties.MCDFIPS}-${feature.properties.PARKDIST}`;
  };
  let defaultParser = input => {
    let mcdFips = input.MCDFIPS.toString().padStart(5, '0');

    return {
      mcdFips,
      localId: input.PARKDIST.toString().padStart(2, '0'),
      title: `${input.PARKDIST_N} District ${input.PARKDIST}`,
      shortTitle: `District ${input.PARKDIST}`
    };
  };

  return {
    2018: {
      url:
        'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/vtd/vtd2018general',
      output: 'vtd2018general.geo.json',
      start: moment('2018-01-01'),
      end: moment('2019-12-31'),
      parser: defaultParser,
      filter: defaultFilter,
      grouping: defaultGrouping,
      countyParentYear: 2017
    },
    2016: {
      url:
        'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/vtd/vtd2016general',
      output: 'vtd2016general.geo.json',
      start: moment('2016-01-01'),
      end: moment('2017-12-31'),
      parser: defaultParser,
      filter: defaultFilter,
      grouping: defaultGrouping,
      countyParentYear: 2017
    },
    2014: {
      url:
        'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/vtd/vtd2014general',
      output: 'vtd2014general.geo.json',
      start: moment('2014-01-01'),
      end: moment('2015-12-31'),
      parser: defaultParser,
      filter: defaultFilter,
      grouping: defaultGrouping,
      countyParentYear: 2017
    }
    // No MCD data
    // 2012: {
    //   url:
    //     'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/vtd/vtd2012general',
    //   output: 'vtd2014general.geo.json',
    //   start: moment('2012-01-01'),
    //   end: moment('2013-12-31'),
    //   parser: defaultParser,
    //   filter: defaultFilter,
    //   grouping: defaultGrouping,
    //   countyParentYear: 2017
    // }
  };
}
