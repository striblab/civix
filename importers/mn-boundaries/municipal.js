/**
 * Minnesota state legislature: MCD
 *
 * From:
 * https://www.gis.leg.mn/html/download.html
 */

// Dependencies
const _ = require('lodash');
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
      `Unable to find information about Precinct set ${argv.year}`
    );
  }
  districtSet.year = argv.year;

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
    let boundaryId = `usa-mn-county-local-27${parsed.fips.toLowerCase()}`;
    let boundaryVersionId = `${districtSet.start.year()}-${boundaryId}`;

    // Skip county check since we may have multiple
    let countyIds = parsed.allCounties.map(c => `usa-county-27${c}`);

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
        division_id: 'county-local',
        sourceData: {
          'mn-state-leg': {
            about:
              'Calculated from precinct data set.  See specific version for original data.',
            url: 'https://www.gis.leg.mn/html/download.html'
          }
        }
      },
      post: async (r, { transaction }) => {
        await r[0].addParents(countyIds, { transaction });
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
        fips: parsed.fips,
        geoid: parsed.geoid,
        // Use date strings so that Sequelize/postgres doesn't get
        // offset by timezones
        start: districtSet.start.format('YYYY-MM-DD'),
        end: districtSet.end.format('YYYY-MM-DD'),
        geometry: district.geometry,
        boundary_id: boundaryId,
        sourceData: {
          'mn-state-leg': {
            about:
              'Calculated from precinct data set.  Data from first row of group.',
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
    let mcdCode = input.MCDCODE.toString().padStart(3, '0');
    let mcdFips = input.MCDFIPS.toString().padStart(5, '0');

    // Note that some local areas span multiple counties, and each
    // part has it's own entry.

    return {
      localId: mcdCode,
      fips: mcdFips,
      // This is fuzzy since a municpal can have multiple counties
      //geoid: `27${countyFips}${mcdFips}`,
      title: input.MCDNAME.replace(/\s+unorg$/i, ' Unorganized Territory')
        .replace(/\s+twp$/i, ' Township')
        .trim(),
      shortTitle: input.MCDNAME.replace(/\s+unorg$/i, '')
        .replace(/\s+twp$/i, '')
        .trim(),
      allCounties: _.uniq(
        input.fullGroup.map(p => {
          return p.COUNTYFIPS.toString().padStart(3, '0');
        })
      )
    };
  };
  let defaultGrouping = feature => {
    return `27${feature.properties.MCDFIPS.toString().padStart(5, '0')}`;
  };

  return {
    2018: {
      url:
        'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/vtd/vtd2018general',
      output: 'vtd2018general.geo.json',
      start: moment('2018-01-01'),
      end: moment('2019-12-31'),
      parser: defaultParser,
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
      grouping: defaultGrouping,
      countyParentYear: 2017
    }
    // 2012 doesn't have code information for MCDs
    // 2012: {
    //   url:
    //     'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/vtd/vtd2012general',
    //   output: 'vtd2014general.geo.json',
    //   start: moment('2012-01-01'),
    //   end: moment('2013-12-31'),
    //   parser: defaultParser,
    //   grouping: defaultGrouping,
    //   countyParentYear: 2017
    // }
  };
}
