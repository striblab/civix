/**
 * Census TIGER: Congressional districts
 *
 * From:
 * https://www.census.gov/geo/maps-data/data/cbf/cbf_cds.html
 */

// Dependencies
const moment = require('moment');
const { makeSort } = require('../../lib/strings.js');
const { importRecords, processGeo } = require('../../lib/importing.js');

// Import function
module.exports = async function tigerStatesImporter({
  logger,
  models,
  db,
  argv
}) {
  // Look for year from argv
  if (!argv.congress) {
    throw new Error(
      'A congress argument must be provided, for example "--congress=115"'
    );
  }

  // Find congress
  let congressSet = congresses()[argv.congress];
  if (!congressSet) {
    throw new Error(
      `Unable to find information about Congress ${argv.congress}`
    );
  }
  congressSet.congress = argv.congress;

  // Log
  logger('info', `Census TIGER: Congressional districts ${argv.congress} ...`);

  // Collect records to save
  let records = [];

  // Go through congress years
  for (let congress of congressSet) {
    // Download
    let districts = await processGeo({
      url: congress.url,
      shapePath: congress.shapefile,
      inputProjection: 'EPSG:4269',
      filter: congress.filter,
      logger
    });

    // Go through districts
    for (let district of districts.features) {
      let p = district.properties;
      let parsed = congress.parser(p, congress);
      let boundaryId = `usa-congressional-district-${parsed.geoid}`;
      let boundaryVersionId = `${
        congressSet.congress
      }-${congress.start.year()}-${boundaryId}`;

      // Get state
      let stateVersion = await models.BoundaryVersion.findOne({
        where: { fips: parsed.state }
      });
      let state = await models.Boundary.findOne({
        where: { id: stateVersion.get('boundary_id') }
      });
      if (!state) {
        throw new Error(
          `Unable to find state with GEOID code: ${parsed.geoid}`
        );
      }

      // Make title from state
      let title = `${state.get(
        'title'
      )} Congressional District ${parsed.localId.replace(/^0+/, '')}`;

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
          division_id: 'congress',
          sourceData: {
            'census-tiger-congress': {
              about: 'See specific version for original data.',
              url: 'https://www.census.gov/geo/maps-data/data/cbf/cbf_cds.html'
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
          fips: parsed.fips,
          geoid: parsed.geoid,
          affgeoid: parsed.affgeoid,
          // Use date strings so that Sequelize/postgres doesn't get
          // offset by timezones
          start: congress.start.format('YYYY-MM-DD'),
          end: congress.end.format('YYYY-MM-DD'),
          geometry: district.geometry,
          boundary_id: boundaryId,
          sourceData: {
            'census-tiger-congress': {
              url: 'https://www.census.gov/geo/maps-data/data/cbf/cbf_cds.html',
              data: p
            }
          }
        }
      };
      records.push(boundaryVersion);
    }
  }

  // Import records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};

// Processing each congress
function congresses() {
  let defaultParser = input => {
    return {
      localId: `${input['CD' + input.CDSESSN + 'FP']}`,
      state: input.STATEFP,
      fips: `${input.STATEFP}${input['CD' + input.CDSESSN + 'FP']}`,
      affgeoid: input.AFFGEOID,
      geoid: input.GEOID
    };
  };
  let defaultFilter = feature => {
    return (
      feature.properties.CDSESSN &&
      feature.properties[`CD${feature.properties.CDSESSN}FP`] &&
      feature.properties[`CD${feature.properties.CDSESSN}FP`].toLowerCase() !==
        'zz' &&
      feature.properties[`CD${feature.properties.CDSESSN}FP`].toLowerCase() !==
        '98'
    );
  };

  return {
    116: [
      {
        url:
          'https://www2.census.gov/geo/tiger/TIGER2018/CD/tl_2018_us_cd116.zip',
        shapefile: 'tl_2018_us_cd116.shp',
        start: moment('2018-01-01'),
        end: moment('2018-12-31'),
        parser: defaultParser,
        filter: defaultFilter
      }
    ],
    115: [
      {
        url:
          'https://www2.census.gov/geo/tiger/GENZ2017/shp/cb_2017_us_cd115_500k.zip',
        shapefile: 'cb_2017_us_cd115_500k.shp',
        start: moment('2017-01-01'),
        end: moment('2017-12-31'),
        parser: defaultParser,
        filter: defaultFilter
      },
      {
        url:
          'https://www2.census.gov/geo/tiger/GENZ2016/shp/cb_2016_us_cd115_500k.zip',
        shapefile: 'cb_2016_us_cd115_500k.shp',
        start: moment('2016-01-01'),
        end: moment('2016-12-31'),
        parser: defaultParser,
        filter: defaultFilter
      }
    ],
    114: [
      {
        url:
          'https://www2.census.gov/geo/tiger/GENZ2015/shp/cb_2015_us_cd114_500k.zip',
        shapefile: 'cb_2015_us_cd114_500k.shp',
        start: moment('2015-01-01'),
        end: moment('2015-12-31'),
        parser: defaultParser,
        filter: defaultFilter
      },
      {
        url:
          'https://www2.census.gov/geo/tiger/GENZ2014/shp/cb_2014_us_cd114_500k.zip',
        shapefile: 'cb_2014_us_cd114_500k.shp',
        start: moment('2014-01-01'),
        end: moment('2014-12-31'),
        parser: defaultParser,
        filter: defaultFilter
      }
    ],
    113: [
      {
        url:
          'https://www2.census.gov/geo/tiger/GENZ2013/cb_2013_us_cd113_500k.zip',
        shapefile: 'cb_2013_us_cd113_500k.shp',
        start: moment('2012-01-01'),
        end: moment('2013-12-31'),
        parser: defaultParser,
        filter: defaultFilter
      }
    ],
    112: [
      {
        url:
          'https://www2.census.gov/geo/tiger/TIGER2011/CD/tl_2011_us_cd112.zip',
        shapefile: 'tl_2011_us_cd112.shp',
        start: moment('2010-01-01'),
        end: moment('2011-12-31'),
        parser: defaultParser,
        filter: defaultFilter
      }
    ],
    111: [
      {
        url:
          'https://www2.census.gov/geo/tiger/GENZ2010/gz_2010_us_500_11_5m.zip',
        shapefile: 'gz_2010_us_500_11_5m.shp',
        start: moment('2008-01-01'),
        end: moment('2009-12-31'),
        parser: input => {
          return {
            localId: input.CD,
            state: input.STATE,
            fips: `${input.STATE}${input.CD}`,
            affgeoid: input.GEO_ID,
            geoid: input.GEO_ID ? input.GEO_ID.substr(-4) : null
          };
        },
        filter: feature => {
          return feature.properties.CD;
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
        parser: input => {
          return {
            localId: input.CD,
            state: input.STATE,
            fips: `${input.STATE}${input.CD}`,
            affgeoid: null,
            geoid: `${input.STATE}${input.CD}`
          };
        },
        filter: feature => {
          return feature.properties.CD;
        }
      }
    ]
  };
}
