/**
 * Minnesota state legislature: Precincts
 *
 * From:
 * https://www.gis.leg.mn/html/download.html
 */

// Dependencies
const _ = require('lodash');
const fs = require('fs');
const moment = require('moment');
const reproject = require('../../lib/reproject.js');
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
      `Unable to find information about Precinct set ${argv.year}`
    );
  }

  districtSet.year = argv.year;
  logger('info', `MN State Leg: Precincts ${argv.year} ...`);

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
  let boundaryId = `usa-mn-precinct-${parsed.localId.toLowerCase()}`;
  let boundaryVersionId = `${districtSet.start.year()}-${boundaryId}`;

  // Get county
  let countyVersion = await models.BoundaryVersion.findOne({
    where: {
      id: `${districtSet.countyParentYear}-usa-county-27${parsed.countyFips}`
    }
  });
  let county = await models.Boundary.findOne({
    where: { id: countyVersion.get('boundary_id') }
  });
  if (!county) {
    throw new Error(
      `Unable to find county with FIPS code: ${parsed.countyFips}`
    );
  }

  // Create general boundary if needed
  let boundary = await db.findOrCreateOne(models.Boundary, {
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
      parent_id: county.get('id'),
      division_id: 'county-precinct',
      sourceData: {
        'mn-state-leg': {
          about: 'See specific version for original data.',
          url: 'https://www.gis.leg.mn/html/download.html'
        }
      }
    }
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

// Processing each congress
function districtSets() {
  let defaultParser = input => {
    return {
      localId: input.VTDID,
      title: input.PCTNAME,
      shortTitle: input.SHORTLABEL ? input.SHORTLABEL : input.MCDNAME,
      countyFips: input.COUNTYFIPS.padStart(3, '0')
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
      countyParentYear: 2017
    },
    2016: {
      url:
        'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/vtd/vtd2016general',
      output: 'vtd2016general.geo.json',
      start: moment('2016-01-01'),
      end: moment('2017-12-31'),
      parser: defaultParser,
      countyParentYear: 2017
    },
    2014: {
      url:
        'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/vtd/vtd2014general',
      output: 'vtd2014general.geo.json',
      start: moment('2014-01-01'),
      end: moment('2015-12-31'),
      parser: defaultParser,
      countyParentYear: 2017
    },
    2012: {
      url:
        'https://www.gis.leg.mn/php/shptoGeojson.php?file=/geo/data/vtd/vtd2012general',
      output: 'vtd2014general.geo.json',
      start: moment('2012-01-01'),
      end: moment('2013-12-31'),
      parser: input => {
        // PCTNAME is capitalized, but MCDNAME is not
        return {
          localId: input.VTD,
          title: input.SHORTLABEL
            ? `${input.MCDNAME} ${input.SHORTLABEL}`
            : input.MCDNAME,
          shortTitle: input.SHORTLABEL ? input.SHORTLABEL : input.MCDNAME,
          countyFips: input.COUNTYFIPS.toString().padStart(3, '0')
        };
      },
      countyParentYear: 2017
    }
  };
}
