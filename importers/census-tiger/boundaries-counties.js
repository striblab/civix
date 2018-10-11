/**
 * Census TIGER: Congressional districts
 *
 * From:
 * https://www.census.gov/geo/maps-data/data/cbf/cbf_cds.html
 */

// Dependencies
const _ = require('lodash');
const path = require('path');
const moment = require('moment');
const { shapes } = require('../../lib/shapefile.js');
const { makeSort } = require('../../lib/strings.js');
const { download } = require('../../lib/download.js');

// Import function
module.exports = async function tigerCountiesImporter({
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

  // Find info about counties
  let countySet = countySets()[argv.year];
  if (!countySet) {
    throw new Error(`Unable to find information about County set ${argv.year}`);
  }

  countySet.year = argv.year;
  logger('info', `Census TIGER: County set ${argv.year} ...`);

  // Start transaction
  const transaction = await db.sequelize.transaction();
  try {
    results = results.concat(
      await importCountySet({
        countySet,
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
async function importCountySet({ countySet, db, transaction, models, logger }) {
  let results = [];
  logger(
    'info',
    'Downloading shapefile, can take a moment if not already cached ...'
  );

  // Get file
  let dl = await download({
    ttl: 1000 * 60 * 60 * 24 * 30,
    url: countySet.url,
    output: countySet.shapefile
  });

  // Read in the shapefile and reproject
  let counties = await shapes(path.join(dl.output, countySet.shapefile), {
    originalProjection: 'EPSG:4269'
  });

  // Go through districts
  for (let county of counties) {
    results = results.concat(
      await importCounty({
        countySet,
        county,
        db,
        models,
        transaction
      })
    );
  }

  return results;
}

// Import a district
async function importCounty({ countySet, county, db, transaction, models }) {
  let p = county.properties;
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
  let boundary = await db
    .findOrCreateOne(models.Boundary, {
      transaction,
      where: { id: boundaryId },
      include: models.Boundary.__associations,
      defaults: {
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
      fips: parsed.fips,
      geoid: parsed.geoid,
      affgeoid: parsed.affgeoid,
      start: countySet.start,
      end: countySet.end,
      geometry: county.geometry,
      boundary_id: boundaryId,
      sourceData: {
        'census-tiger-counties': {
          url:
            'https://www.census.gov/geo/maps-data/data/cbf/cbf_counties.html',
          data: p
        }
      }
    }
  });

  return [boundary, boundaryVersion];
}

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
    2017: {
      url:
        'http://www2.census.gov/geo/tiger/GENZ2017/shp/cb_2017_us_county_500k.zip',
      shapefile: 'cb_2017_us_county_500k.shp',
      start: moment('2017-01-01'),
      end: null,
      parser: defaultParser
    }
  };
}
