/**
 * Minnesota state legislature: State senate districts
 *
 * From:
 * https://www.gis.leg.mn/html/download.html
 */

// Dependencies
const _ = require('lodash');
const fs = require('fs');
const moment = require('moment');
const reproject = require('../../lib/reproject.js');
const { makeSort } = require('../../lib/strings.js');
const { download } = require('../../lib/download.js');

// Import function
module.exports = async function mnStateLegStateSenateImporter({
  logger,
  models,
  db,
  argv
}) {
  let results = [];

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
  logger('info', `MN State Leg: State senate ${argv.year} ...`);

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

// Import a year of congress
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
  let boundary = await db
    .findOrCreateOne(models.Boundary, {
      transaction,
      where: { id: boundaryId },
      include: models.Boundary.__associations,
      defaults: {
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
      }
    })
    .then(async r => {
      await r[0].addParents([state.get('id')], { transaction });
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
      localId: parsed.localId,
      geoid: parsed.geoid,
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
