/**
 * Get results from MN API, updates data.
 */

// Dependencies
const _ = require('lodash');
const MNElections = require('../../lib/mn-elections.js').MNElections;
const ensureMNAPISource = require('./source-mn-sos-api.js');
const debug = require('debug')('civix:importer:mn-results');

// Import function
module.exports = async function mnElectionsMNResultsImporter({
  logger,
  models,
  db,
  config
}) {
  logger('info', 'MN (via API) Results importer...');

  // Election information
  const electionString = '2018-08-14';
  const electionDate = new Date(electionString);
  const electionDateId = electionString.replace(/-/g, '');
  const electionRecord = {
    id: `mn-${electionDateId}`,
    name: `mn-${electionDateId}`,
    title: `Minnesota Primary ${electionString}`,
    sort: `${electionDateId} minnesota primary`,
    date: electionDate,
    type: 'primary',
    boundary_id: 'state-mn',
    sourceData: {
      'civix-ap-elex': {
        manual: true
      }
    }
  };

  // Get elex candidates (via results)
  const mnElections = new MNElections({
    logger,
    defaultElection: electionDateId
  });
  const contests = await mnElections.results();

  // Create transaction
  const transaction = await db.sequelize.transaction();

  // Wrap to catch any issues and rollback
  try {
    // Gather results
    let results = [];

    // Make common source
    let sourceResult = await ensureMNAPISource({ models, transaction });
    results.push(sourceResult);
    let source = sourceResult[0];

    // Create election
    let electionRecordResults = await db.findOrCreateOne(models.Election, {
      where: { id: electionRecord.id },
      defaults: electionRecord,
      transaction
    });
    results.push(electionRecordResults);
    let election = electionRecordResults[0];

    // Import results
    results = results.concat(
      await importContests({
        contests,
        db,
        transaction,
        models,
        source,
        election,
        config
      })
    );

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

// Import contests
async function importContests({
  contests,
  db,
  models,
  transaction,
  source,
  election,
  config
}) {
  let results = [];

  for (let contest of contests) {
    results = results.concat(
      await importContest({
        election,
        contest,
        db,
        models,
        transaction,
        source,
        config
      })
    );
  }

  return results;
}

// Import specific race
async function importContest({
  election,
  contest,
  db,
  models,
  transaction,
  source,
  config
}) {
  let original = _.cloneDeep(contest);
  let results = [];

  // Ignore races that AP covers
  if (
    ~['state-house', 'state', 'us-senate', 'us-house', 'judicial'].indexOf(
      contest.type
    )
  ) {
    return [];
  }

  // Get contest
  let contestId = db.makeIdentifier(['mn', contest.id]);
  let contestRecord = await models.Contest.findOne({
    where: { id: contestId, election_id: election.get('id') },
    transaction
  });
  if (!contestRecord) {
    throw new Error(
      `Unable to find contest, ${contestId}, make sure to run mn-elections/mn-contests first.`
    );
  }

  // Update
  results.push([
    await contestRecord.update(
      {
        reporting: contest.precincts,
        totalPrecincts: contest.totalPrecincts,
        totalVotes: contest.totalVotes,
        sourceData: {
          [source.get('id')]: {
            data: _.omit(original, ['candidate'])
          }
        }
      },
      { transaction }
    ),
    false
  ]);

  // Go through candidates
  for (let candidate of contest.candidates) {
    // Create results ID
    let resultId = db.makeIdentifier(['mn', candidate.id]);
    let resultRecord = {
      id: resultId,
      contest_id: contestRecord.get('id'),
      candidate_id: resultId,
      localId: candidate.id,
      units: undefined,
      votes: candidate.votes,
      percent:
        candidate.percent || candidate.percent === 0
          ? candidate.percent / 100
          : undefined,
      winner: candidate.winner,
      test: config.testResults,
      resultDetails: candidate.ranks,
      sourceData: {
        [source.get('id')]: {
          data: candidate
        }
      }
    };

    results.push(
      await db.updateOrCreateOne(models.Result, {
        where: { id: resultRecord.id },
        defaults: resultRecord,
        pick: ['test', 'winner', 'votes', 'percent', 'sourceData'],
        transaction
      })
    );
  }

  return results;
}
