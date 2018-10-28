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
      r.reportingunitid.match(/^county/i)
    );
  });

  // Go through results
  for (let result of results) {
    // Parse out some of the high level data and Ids
    let parsed = contestParser(result, { election });

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
      votes: result.votecount,
      percent: result.votepct,
      winner: result.winner,
      incumbent: result.incumbent,
      test: config.testResults,
      sourceData: {
        'ap-elex': {
          data: result
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
        reporting: result.precinctsreporting,
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
