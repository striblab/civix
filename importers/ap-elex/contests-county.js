/**
 * Get results from AP.  This updates existing data.
 */

// Dependencies
const _ = require('lodash');
const Elex = require('../../lib/elex.js').Elex;
const contestParser = require('./lib/parse-contests.js');
const { importRecords } = require('../../lib/importing.js');
const { makeSort } = require('../../lib/strings.js');

// Import function
module.exports = async function coreDataElexRacesImporter({
  logger,
  models,
  db,
  argv
}) {
  // Batch if not defined
  argv.batch = argv.batch === undefined ? 200 : argv.batch;

  // Make sure election is given
  if (!argv.election) {
    throw new Error(
      'An election argument must be provided, for example "--election="2018-11-06"'
    );
  }

  // Make sure state is given
  if (!argv.state) {
    throw new Error(
      'An state argument must be provided, for example "--state="mn'
    );
  }

  // Get election
  let election = await models.Election.findOne({
    where: {
      id: `usa-${argv.state}-${argv.election.replace(/-/g, '')}`
    }
  });
  if (!election) {
    throw new Error(`Unable to find election: ${argv.state}-${argv.election}`);
  }

  // Get elex races.  We use the results to set things up, since
  // it has more details and sub-contests
  const elex = new Elex({ logger, defaultElection: argv.election });
  let { data: results, cached } = await elex.results();

  // If cached, then there's no reason to do anything
  if (cached && !argv.ignoreCache) {
    logger.info('Elex results was cached, no need to do anything.');
    return;
  }

  // Records for db
  let records = [];

  // Filter results to just the top level
  results = _.filter(results, r => {
    return (
      r.statepostal === argv.state.toUpperCase() &&
      r.ballotorder === 1 &&
      r.reportingunitid.match(/^county/i)
    );
  });

  // Go through results
  for (let result of results) {
    // Parse out some of the high level data and Ids
    let parsed = contestParser(result, { election });

    // Get county fips
    let countyFips = result.fipscode;
    let countyName = result.reportingunitname;

    // Boundary version id
    let boundaryVersionId = `2018-usa-county-${countyFips}`;

    // Division id
    let divisionId = 'county';

    // New AP id
    let apId = `${result.raceid}-${result.fipscode}`;

    // Make new id
    let contestId = `${parsed.contest.id}-county-${countyFips}`;
    let title = `${parsed.contest.title} ${countyName} County Results`;

    // Make record
    records.push({
      model: models.Contest,
      record: _.extend(parsed.contest, {
        id: contestId,
        name: contestId,
        title: title,
        shortTitle: `${countyName}`,
        sort: makeSort(title),
        apId: apId,
        subContest: true,
        boundary_version_id: boundaryVersionId,
        division_id: divisionId,
        parent_id: parsed.contest.id,
        sourceData: {
          'ap-elex': {
            about: 'Taken from results level data',
            data: result
          }
        }
      })
    });
  }

  // Import records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
