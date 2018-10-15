/**
 * Minnesota state legislature: Park Districts
 *
 * From:
 * https://www.gis.leg.mn/html/download.html
 */

// Dependencies
const _ = require('lodash');
const fs = require('fs');
const moment = require('moment');
const reproject = require('../../lib/reproject.js');
const { union } = require('@turf/turf');
const { makeSort, makeId } = require('../../lib/strings.js');
const { download } = require('../../lib/download.js');

// Import function
module.exports = async function mnStateLegStateHouseImporter({
  logger,
  models,
  db,
  argv
}) {
  let results = [];

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
      `Unable to find information about Park Districts set ${argv.year}`
    );
  }

  districtSet.year = argv.year;
  logger('info', `MN State Leg: Park Districts ${argv.year} ...`);

  // Start transaction
  const transaction = await db.sequelize.transaction();
  try {
    results = results.concat(
      await importDistrictSet({
        districtSet,
        db,
        transaction,
        models,
        logger
      })
    );

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

// Import a set
async function importDistrictSet({
  districtSet,
  db,
  transaction,
  models,
  logger
}) {
  let results = [];
  logger(
    'info',
    'Downloading shapes, can take a moment if not already cached ...'
  );

  // Get file
  let dl = await download({
    ttl: 1000 * 60 * 60 * 24 * 30,
    url: districtSet.url,
    output: districtSet.output
  });

  // Get data
  let districts = JSON.parse(fs.readFileSync(dl.output, 'utf-8'));

  // Filter
  districts.features = _.filter(districts.features, districtSet.filter);

  // Group
  let grouped = _.groupBy(districts.features, districtSet.grouping);
  districts.features = _.map(grouped, group => {
    return {
      type: 'Feature',
      properties: _.extend(group[0].properties, {
        fullGroup: _.cloneDeep(_.map(group, 'properties'))
      }),
      geometry: group.length > 1 ? union(...group).geometry : group[0].geometry
    };
  });

  // Reproject and multipolygon
  for (let fi in districts.features) {
    districts.features[fi] = await reproject(
      districts.features[fi],
      'EPSG:26915',
      'EPSG:4326'
    );

    if (districts.features[fi].geometry.type === 'Polygon') {
      districts.features[fi].geometry.type = 'MultiPolygon';
      districts.features[fi].geometry.coordinates = [
        districts.features[fi].geometry.coordinates
      ];
    }
  }

  // Go through districts
  for (let district of districts.features) {
    results = results.concat(
      await importDistrict({
        districtSet,
        district,
        db,
        models,
        transaction
      })
    );
  }

  return results;
}

// Import a district
async function importDistrict({
  districtSet,
  district,
  db,
  transaction,
  models
}) {
  let p = district.properties;
  let parsed = districtSet.parser(p, districtSet);
  let boundaryId = `usa-mn-park-district-27${parsed.localId.toLowerCase()}`;
  let boundaryVersionId = `${districtSet.start.year()}-${boundaryId}`;

  // Could have multiple county parents
  let countyIds = parsed.allCounties.map(c => `usa-county-27${c}`);

  // State parent
  let stateId = 'usa-state-mn';

  // Create general boundary if needed
  let boundary = await db
    .findOrCreateOne(models.Boundary, {
      transaction,
      where: { id: boundaryId },
      include: models.Boundary.__associations,
      defaults: {
        id: boundaryId,
        name: boundaryId,
        title: parsed.title,
        shortTitle: parsed.shortTitle,
        sort: makeSort(parsed.title),
        localId: parsed.localId.toLowerCase(),
        division_id: 'hospital',
        sourceData: {
          'mn-state-leg': {
            about: 'See specific version for original data.',
            url: 'https://www.gis.leg.mn/html/download.html'
          }
        }
      }
    })
    .then(async r => {
      await r[0].addParents(_.filter([].concat(countyIds).concat([stateId])), {
        transaction
      });
      return r;
    });

  // Create boundary version
  let boundaryVersion = await db.findOrCreateOne(models.BoundaryVersion, {
    transaction,
    where: { id: boundaryVersionId },
    include: models.BoundaryVersion.__associations,
    defaults: {
      id: boundaryVersionId,
      name: boundaryVersionId,
      localId: parsed.localId.toLowerCase(),
      start: districtSet.start,
      end: districtSet.end,
      geometry: district.geometry,
      boundary_id: boundaryId,
      sourceData: {
        'mn-state-leg': {
          url: 'https://www.gis.leg.mn/html/download.html',
          data: p
        }
      }
    }
  });

  return [boundary, boundaryVersion];
}

// Processing each set of districts
function districtSets() {
  let defaultFilter = feature => {
    return (
      feature.properties.PARKDIST &&
      feature.properties.PARKDIST_N.match(/park.*district/i)
    );
  };
  let defaultGrouping = feature => {
    return feature.properties.PARKDIST.toString().padStart(2, '0');
  };
  let defaultParser = input => {
    return {
      localId: input.PARKDIST.toString().padStart(2, '0'),
      title: `${input.PARKDIST_N} ${input.PARKDIST}`,
      shortTitle: `District ${input.PARKDIST}`,
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
    // PARKDIST_N doesn't exists so hard to know what set
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
