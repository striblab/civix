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
      (!r.reportingunitid || r.reportingunitid.match(/^state/i))
    );
  });

  // Go through results
  for (let result of results) {
    // Parse out some of the high level data and Ids
    let parsedContest = contestParser(result, { election });

    // Candidate id
    let candidateId = `${parsedContest.contest.id}-${result.candidateid}`;

    // Don't get candidate or contest record for speed

    // Make default id
    let resultId = candidateId;

    // If county, make parent id
    // TODO

    // Create result record
    let resultRecord = {
      id: resultId,
      contest_id: parsedContest.contest.id,
      candidate_id: candidateId,
      // Production data doesn't have reportingunitid, which is used
      // in creating the ID, and there is a "None", which assumingly
      // comes from Elex. Who knows.
      apId: result.id.replace('-None', '-state-MN-1'),
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
          'apId',
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
        id: parsedContest.contest.id,
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
