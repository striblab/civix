/**
 * Import for MN SoS: results
 */

// Dependencies
const { importRecords } = require('../../lib/importing.js');
const { getFiles } = require('./lib/election-files.js');
const { contestParser } = require('./lib/parse-contests.js');
//const debug = require('debug')('civix:importer:mn-candidates');

// AP level results
const apLevelResults = [
  'state',
  'us-house',
  'us-senate',
  'state-lower',
  'state-upper',
  'judicial',
  'judicial-district'
];

// Import function
module.exports = async function mnElectionsMNContestsImporter({
  logger,
  models,
  db,
  argv,
  config
}) {
  // Batch if not defined
  argv.batch = argv.batch === undefined ? 200 : argv.batch;

  // Make sure election is given
  if (!argv.election) {
    throw new Error(
      'An election argument must be provided, for example --election="2018-11-06"'
    );
  }

  // By default, ignore AP
  if (argv.includeAp) {
    logger.info('Including AP level contests.');
  }

  // Get election
  let election = await models.Election.findOne({
    where: {
      id: `usa-mn-${argv.election.replace(/-/g, '')}`
    }
  });
  if (!election) {
    throw new Error(`Unable to find election: mn-${argv.election}`);
  }

  // Warn if we have the zero flag
  if (argv.zero) {
    logger.info(
      '--zero flag enabled; ALL RESULTS AND PRECINCTS WILL BE ZERO AND WINNERS WILL BE SET TO FALSE.'
    );
  }

  // Get files
  let files = await getFiles(election.get('date'), argv, { logger });

  // Records
  let records = [];

  // Go through files
  for (let file of files) {
    for (let ci in file.contests) {
      let c = file.contests[ci];

      // Exclude AP
      if (!argv.includeAp) {
        if (~apLevelResults.indexOf(file.type)) {
          continue;
        }
      }

      // Run through parsers
      let parsedContest = await contestParser(c, {
        type: file.type,
        election,
        models,
        db
      });

      // If not parsed, then that means we are skipping it for a reason
      if (!parsedContest) {
        continue;
      }

      // Go through results/candidates
      for (let result of c) {
        // Candidate Id
        let candidateId = `${parsedContest.contest.id}-${result.candidate}`;

        // Make default id
        let resultId = candidateId;

        // Create result record
        let resultRecord = {
          id: resultId,
          contest_id: parsedContest.contest.id,
          candidate_id: candidateId,
          localId: `${result.id}-${result.candidate}`,
          units: undefined,
          votes: argv.zero ? 0 : result.votes,
          percent: argv.zero
            ? 0
            : result.percent
              ? result.percent / 100
              : undefined,
          winner: argv.zero ? false : undefined,
          incumbent: undefined,
          test: config.testResults,
          sourceData: {
            'mn-sos-ftp': {
              data: result
            }
          }
        };

        records.push({
          model: models.Result,
          record: resultRecord
        });

        // Update contest record
        records.push({
          model: models.Contest,
          record: {
            id: parsedContest.contest.id,
            reporting: argv.zero ? 0 : result.precincts,
            totalPrecincts: result.totalPrecincts
          },
          options: {
            pick: ['reporting', 'totalPrecincts']
          }
        });
      }
    }
  }

  // Save records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
