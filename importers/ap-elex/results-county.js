/**
 * Get results from AP.  This updates existing data.
 */

// Dependencies
const _ = require('lodash');
const Elex = require('../../lib/elex.js').Elex;
const contestParser = require('./lib/parse-contests.js');
const { importRecords } = require('../../lib/importing.js');

// Import function
module.exports = async function coreDataElexRacesImporter({
  logger,
  models,
  db,
  config,
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

  // Notify about limited county processing
  if (config.elexCountyContests && config.elexCountyContests.length) {
    logger.info(
      `Only processing county results for ${
        config.elexCountyContests.length
      } contests`
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

  // Warn if we have the zero flag
  if (argv.zero) {
    logger.info(
      '--zero flag enabled; ALL RESULTS AND PRECINCTS WILL BE ZERO AND WINNERS WILL BE SET TO FALSE.'
    );
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
      r.reportingunitid &&
      r.reportingunitid.match(/^county/i)
    );
  });

  // Production data doesn't seem to have county data
  // at least a few days out.
  if (!results || !results.length) {
    logger.info(
      'County results were not available; the AP may not provide this data leading up to the election.  Your best bet is to use the "test" data with the --zero flag, which should have county level results.'
    );
    return;
  }

  // Go through results
  for (let result of results) {
    // Parse out some of the high level data and Ids
    let parsed = contestParser(result, { election });

    // Filter out specific contests
    if (_.isArray(config.elexCountyContests)) {
      if (config.elexCountyContests.indexOf(parsed.contest.id) === -1) {
        continue;
      }
    }

    // Get county fips
    let countyFips = result.fipscode;
    //let countyName = result.reportingunitname;

    // Candidate id
    let candidateId = `${parsed.contest.id}-${result.candidateid}`;

    // Contest Id
    let contestId = `${parsed.contest.id}-county-${countyFips}`;

    // Make new id
    let id = `${candidateId}-county-${countyFips}`;

    // Make results
    let resultRecord = {
      id: id,
      contest_id: contestId,
      candidate_id: candidateId,
      apId: result.id,
      apUpdated: result.lastupdated ? new Date(result.lastupdated) : undefined,
      units: undefined,
      votes: argv.zero ? 0 : result.votecount,
      percent: argv.zero ? 0 : result.votepct,
      winner: argv.zero ? false : result.winner,
      incumbent: result.incumbent,
      test: config.testResults,
      sourceData: {
        'ap-elex': {
          data: result,
          args: argv
        }
      }
    };

    // TODO: Support update only option
    records.push({
      model: models.Result,
      record: resultRecord,
      options: {
        pick: [
          'test',
          'incumbent',
          'winner',
          'votes',
          'percent',
          'apUpdated',
          'sourceData',
          'resultDetails'
        ]
      }
    });

    // Update contest
    records.push({
      model: models.Contest,
      record: {
        id: contestId,
        reporting: argv.zero ? 0 : result.precinctsreporting,
        totalPrecincts: result.precinctstotal
      },
      options: {
        pick: ['reporting', 'totalPrecincts']
      }
    });
  }

  // Import records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
