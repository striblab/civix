/**
 * Minnesota state legislature: Soil and Water Conservation Districts
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
      `Unable to find information about Soil and Water Conservation Districts set ${
        argv.year
      }`
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
    let boundaryId = `usa-mn-soil-water-${parsed.localId.toLowerCase()}`;
    let boundaryVersionId = `${districtSet.start.year()}-${boundaryId}`;

    // Could have multiple county parents
    let countyIds = parsed.allCounties.map(c => `usa-county-27${c}`);

    // State parent
    let stateId = 'usa-state-mn';

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
        division_id: 'soil-water',
        sourceData: {
          'mn-state-leg': {
            about: 'See specific version for original data.',
            url: 'https://www.gis.leg.mn/html/download.html'
          }
        }
      },
      post: async (r, { transaction }) => {
        await r[0].addParents(
          _.filter([].concat(countyIds).concat([stateId])),
          {
            transaction
          }
        );
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
    return !!feature.properties.SWCDIST && !!feature.properties.SWCDIST_N;
  };
  let defaultGrouping = feature => {
    // Need to get rid of the subdistrict
    return feature.properties.SWCDIST_N.replace(/\s+[0-9]+$/);
  };
  let defaultParser = input => {
    // Get title
    let title = input.SWCDIST_N.replace(/\s+[0-9]+$/, '').trim();

    // Unfortunately, the IDs are by subdistrict, so we use the lowest
    let lowId = _.min(_.map(input.fullGroup, d => parseInt(d.SWCDIST, 10)));

    return {
      localId: `27-${lowId.toString().padStart(4, '0')}`,
      title: `${title} Soil and Water Conservation District`,
      shortTitle: title,
      allCounties: _.uniq(
        input.fullGroup.map(p => {
          return p.COUNTYFIPS.toString().padStart(3, '0');
        })
      )
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
    // Doesn't have name, so we can't determine the larger districts
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
