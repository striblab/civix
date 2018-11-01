/**
 * Determine winner for MN SoS results
 */

// Dependencies
const _ = require('lodash');
const { importRecords } = require('../../lib/importing.js');
const { getFiles } = require('./lib/election-files.js');
const { contestParser } = require('./lib/parse-contests.js');
//const debug = require('debug')('civix:importer:mn-candidates');

// Import function
module.exports = async function mnElectionsMNContestsImporter({
  logger,
  models,
  db,
  argv
  //config
}) {
  // Batch if not defined
  // TODO: Should be one batch/transaction?  Might be a case where one winner is marked,
  // but there should be two?
  argv.batch = argv.batch === undefined ? 200 : argv.batch;

  // This is update only, no matter what
  argv.updateOnly = true;

  // Make sure election is given
  if (!argv.election) {
    throw new Error(
      'An election argument must be provided, for example --election="2018-11-06"'
    );
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

  // Get records.  Contests apId
  let contests = await models.Contest.findAll({
    where: {
      apId: null
    },
    include: [
      // Default all does not get nested parts
      {
        all: true,
        attributes: { exclude: ['sourceData'] }
      },
      // Results
      {
        model: models.Result,
        attributes: { exclude: ['sourceData'] },
        include: [
          {
            model: models.Candidate,
            attributes: { exclude: ['sourceData'] },
            include: [
              {
                model: models.Party,
                attributes: { exclude: ['sourceData'] }
              }
            ]
          }
        ]
      }
    ]
  });

  // Simplify
  contests = _.map(contests, c => {
    return c.get({ plain: true });
  });

  // Records
  let records = [];

  // Go contests
  for (let contest of contests) {
    // Look for winner
    let alreadyHasWinner = !!_.find(contest.results, { winner: true });

    // If already winner, and not option to overwrite, then ignore
    if (!argv.overwriteWinners && alreadyHasWinner) {
      continue;
    }

    // Determine if final
    let fullyReported =
      contest.reporting === contest.totalPrecincts &&
      _.isNumber(contest.totalPrecincts) &&
      contest.totalPrecincts > 0;

    // Determine if there are any votes at all
    let hasVotes = !!_.find(
      contest.results,
      r => _.isNumber(r.votes) && r.votes > 0
    );

    // There are a number of cases, where we don't want to call a winner.
    // * Not fully reported
    // * Has votes
    // * Non-majority, such as ranked choice
    // * If its a primary election, and its a special race, there's no way of
    //   knowing that the special race is a primary or not
    //
    // TODO: For these races, overwrite winner value if --overwrite-winners option is used
    //
    // TODO: Handle ranked-choice
    if (
      !fullyReported ||
      !hasVotes ||
      contest.voteType !== 'majority' ||
      (election.type === 'primary' && election.type === 'special')
    ) {
      continue;
    }

    // TODO: Handle primary
    if (contest.primary) {
      continue;
    }

    // Make sure our results list is sorted by votes
    let results = _.orderBy(contest.results, ['votes'], ['desc']);

    // Go through results and make update records
    _.each(results, (r, ri) => {
      // Select the number of seats that are being elected, but make sure we
      // don't mark a write-in as a winner
      let isWinner = ri < contest.elect && r.candidate.party_id !== 'wi';

      // Make update record
      records.push({
        model: models.Result,
        record: {
          id: r.id,
          winner: isWinner
        },
        options: {
          pick: ['winner']
        }
      });
    });
  }

  // Save records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
