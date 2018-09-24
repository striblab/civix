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
const { download } = require('../../lib/download.js');

// Import function
module.exports = async function tigerStatesImporter({
  logger,
  models,
  db,
  argv
}) {
  let results = [];

  // Look for year from argv
  if (!argv.congress) {
    throw new Error(
      'A congress argument must be provided, for example "--congress=115"'
    );
  }

  // Find congress
  let congress = congresses()[argv.congress];
  if (!congress) {
    throw new Error(
      `Unable to find information about Congress ${argv.congress}`
    );
  }

  congress.congress = argv.congress;
  logger('info', `Census TIGER: Congressional districts ${argv.congress} ...`);

  // Start transaction
  const transaction = await db.sequelize.transaction();
  try {
    // Go through congress years
    for (let y of congress) {
      y.congress = argv.congress;

      results = results.concat(
        await importCongressSet({
          congress: y,
          db,
          transaction,
          models,
          logger
        })
      );
    }

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
async function importCongressSet({
  congress,
  db,
  transaction,
  models,
  logger
}) {
  let results = [];
  logger(
    'info',
    'Downloading shapefile, can take a moment if not already cached ...'
  );

  // Get file
  let dl = await download({
    ttl: 1000 * 60 * 60 * 24 * 30,
    url: congress.url,
    output: congress.shapefile
  });

  // Read in the shapefile and reproject
  let districts = await shapes(path.join(dl.output, congress.shapefile), {
    originalProjection: 'EPSG:4269'
  });

  // Go through districts
  for (let district of districts) {
    results = results.concat(
      await importDistrict({
        congress,
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
async function importDistrict({ congress, district, db, transaction, models }) {
  let p = district.properties;
  let parsed = congress.parser(p, congress);
  let boundaryId = `congressional-district-${parsed.fips}`;
  let boundaryVersionId = `${
    congress.congress
  }-${congress.start.year()}-${boundaryId}`;

  // Get state
  let stateVersion = await models.BoundaryVersion.findOne({
    where: { fips: parsed.state }
  });
  let state = await models.Boundary.findOne({
    where: { id: stateVersion.get('boundary_id') }
  });
  if (!state) {
    throw new Error(`Unable to find state with FIPS code: ${parsed.state}`);
  }

  // Create general boundary if needed
  let boundary = await db.findOrCreateOne(models.Boundary, {
    transaction,
    where: { id: boundaryId },
    include: models.Boundary.__associations,
    defaults: {
      id: boundaryId,
      name: boundaryId,
      title: `${state.get(
        'title'
      )} Congressional District ${parsed.localId.replace(/^0+/, '')}`,
      shortTitle: `District ${parsed.localId.replace(/^0+/, '')}`,
      sort: `${state.get('title')} Congressional district ${
        parsed.localId
      }`.toLowerCase(),
      localId: parsed.localId,
      parent_id: state.get('id'),
      division_id: 'congress',
      sourceData: {
        'census-tiger-congress': {
          about: 'See specific version for original data.',
          url: 'https://www.census.gov/geo/maps-data/data/cbf/cbf_cds.html'
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
      localId: parsed.localId,
      fips: parsed.fips,
      geoid: parsed.geoid,
      affgeoid: parsed.affgeoid,
      start: congress.start,
      end: congress.end,
      geometry: district.geometry,
      boundary_id: boundaryId,
      sourceData: {
        'census-tiger-congress': {
          url: 'https://www.census.gov/geo/maps-data/data/cbf/cbf_cds.html',
          data: p
        }
      }
    }
  });

  return [boundary, boundaryVersion];
}

// Processing each congress
function congresses() {
  let defaultParser = (input, congress) => {
    return {
      localId: `${input['CD' + input.CDSESSN + 'FP']}`,
      state: input.STATEFP,
      fips: `${input.STATEFP}${input['CD' + input.CDSESSN + 'FP']}`,
      affgeoid: input.AFFGEOID,
      geoid: input.GEOID
    };
  };

  return {
    115: [
      {
        url:
          'http://www2.census.gov/geo/tiger/GENZ2017/shp/cb_2017_us_cd115_500k.zip',
        shapefile: 'cb_2017_us_cd115_500k.shp',
        start: moment('2017-01-01'),
        end: moment('2017-12-31'),
        parser: defaultParser
      },
      {
        url:
          'http://www2.census.gov/geo/tiger/GENZ2016/shp/cb_2016_us_cd115_500k.zip',
        shapefile: 'cb_2016_us_cd115_500k.shp',
        start: moment('2016-01-01'),
        end: moment('2016-12-31'),
        parser: defaultParser
      }
    ],
    114: [
      {
        url:
          'http://www2.census.gov/geo/tiger/GENZ2015/shp/cb_2015_us_cd114_500k.zip',
        shapefile: 'cb_2015_us_cd114_500k.shp',
        start: moment('2015-01-01'),
        end: moment('2015-12-31'),
        parser: defaultParser
      },
      {
        url:
          'http://www2.census.gov/geo/tiger/GENZ2014/shp/cb_2014_us_cd114_500k.zip',
        shapefile: 'cb_2014_us_cd114_500k.shp',
        start: moment('2014-01-01'),
        end: moment('2014-12-31'),
        parser: defaultParser
      }
    ],
    113: [
      {
        url:
          'http://www2.census.gov/geo/tiger/GENZ2013/cb_2013_us_cd113_500k.zip',
        shapefile: 'cb_2013_us_cd113_500k.shp',
        start: moment('2012-01-01'),
        end: moment('2013-12-31'),
        parser: defaultParser
      }
    ],
    112: [
      {
        url:
          'https://www2.census.gov/geo/tiger/TIGER2011/CD/tl_2011_us_cd112.zip',
        shapefile: 'tl_2011_us_cd112.shp',
        start: moment('2010-01-01'),
        end: moment('2011-12-31'),
        parser: defaultParser
      }
    ],
    111: [
      {
        url:
          'http://www2.census.gov/geo/tiger/GENZ2010/gz_2010_us_500_11_5m.zip',
        shapefile: 'gz_2010_us_500_11_5m.shp',
        start: moment('2008-01-01'),
        end: moment('2009-12-31'),
        parser: (input, congress) => {
          return {
            localId: input.CD,
            state: input.STATE,
            fips: `${input.STATE}${input.CD}`,
            affgeoid: input.GEO_ID,
            geoid: input.GEO_ID ? input.GEO_ID.substr(-4) : null
          };
        }
      }
    ],
    110: [
      {
        url:
          'https://www2.census.gov/geo/tiger/PREVGENZ/cd/cd110shp/cd99_110_shp.zip',
        shapefile: 'cd99_110.shp',
        start: moment('2006-01-01'),
        end: moment('2007-12-31'),
        parser: (input, congress) => {
          return {
            localId: input.CD,
            state: input.STATE,
            fips: `${input.STATE}${input.CD}`,
            affgeoid: null,
            geoid: `${input.STATE}${input.CD}`
          };
        }
      }
    ]
  };
}
