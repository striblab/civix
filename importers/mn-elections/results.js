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
  logger('info', 'MN SoS Results importer...');

  // Make sure election is given
  if (!argv.election) {
    throw new Error(
      'An election argument must be provided, for example --election="2018-11-06"'
    );
  }

  // By default, ignore AP
  if (argv.includeAp) {
    logger('info', 'Including AP level contests.');
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

  // Get files
  let files = await getFiles(election.get('date'));

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
        models
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
          votes: result.votes,
          percent: result.percent,
          winner: undefined,
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
            reporting: result.precincts,
            totalPrecincts: result.totalVotes
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
