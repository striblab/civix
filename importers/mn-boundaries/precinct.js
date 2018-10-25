/**
 * Minnesota state legislature: Precincts
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
    let boundary = {
      model: models.Boundary,
      record: {
        id: boundaryId,
        name: boundaryId,
        title: parsed.title,
        shortTitle: parsed.shortTitle,
        sort: makeSort(parsed.title),
        localId: parsed.localId.toLowerCase(),
        division_id: 'county-precinct',
        sourceData: {
          'mn-state-leg': {
            about: 'See specific version for original data.',
            url: 'https://www.gis.leg.mn/html/download.html'
          }
        }
      },
      post: async (r, { transaction }) => {
        await r[0].addParents([county.get('id')], { transaction });
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
