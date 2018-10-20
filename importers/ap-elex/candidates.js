/**
 * Get candidates from AP
 */

// Dependencies
const _ = require('lodash');
const Elex = require('../../lib/elex.js').Elex;
const contestParser = require('./lib/parse-contests.js');

// Import function
module.exports = async function coreDataElexRacesImporter({
  logger,
  models,
  db,
  argv
}) {
  logger('info', 'AP (via Elex) Candidates importer...');

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

  // Get elex races.  We use the results to set things up, since
  // it has more details and sub-contests
  const elex = new Elex({ logger, defaultElection: argv.election });
  const results = await elex.results();

  // Create transaction
  const transaction = await db.sequelize.transaction();

  // Wrap to catch any issues and rollback
  try {
    // Gather results
    let importResults = [];

    // Get election
    let election = await models.Election.findOne({
      where: {
        id: `usa-${argv.state}-${argv.election.replace(/-/g, '')}`
      }
    });
    if (!election) {
      throw new Error(
        `Unable to find election: ${argv.state}-${argv.election}`
      );
    }

    // Filter candidates to just the top level
    let candidates = _.filter(results, r => {
      return (
        r.statepostal === argv.state.toUpperCase() &&
        r.reportingunitid.match(/^state/i)
      );
    });

    // Import candidates
    importResults = importResults.concat(
      await importCandidates({
        candidates,
        db,
        transaction,
        models,
        election
      })
    );

    // Log changes
    _.filter(
      importResults.forEach(u => {
        logger(
          'info',
          `[${u[0].constructor.name}] ${u[1] ? 'Created' : 'Existed'}: ${
            u[0].dataValues.id
          }`
        );
      })
    );

    // Commit
    transaction.commit();
    logger('info', 'Transaction committed.');
  }
  catch (error) {
    transaction.rollback();
    logger('error', 'Transaction rolled back; no data changes were made.');
    logger('error', error.stack ? error.stack : error);
    process.exit(1);
  }
};

// Import candidates
async function importCandidates({
  candidates,
  db,
  transaction,
  models,
  election
}) {
  let results = [];

  for (let candidate of candidates) {
    results = results.concat(
      await importCandidate({
        election,
        candidate,
        db,
        models,
        transaction
      })
    );
  }

  return results;
}

// Import single candidate
async function importCandidate({
  election,
  candidate,
  db,
  models,
  transaction
}) {
  // Parse out some of the high level data and Ids
  let parsedContest = contestParser(candidate, { election });

  // Get party.  AP doesn't use DFL, though it should
  let party;
  if (candidate.party.toLowerCase() === 'dem') {
    party = await models.Party.findOne({
      where: { id: 'dfl' },
      transaction
    });
  }
  // No party
  else if (candidate.party.toLowerCase() === 'np') {
    party = await models.Party.findOne({
      where: { id: 'np' },
      transaction
    });
  }
  else {
    party = await models.Party.findOne({
      where: { apId: candidate.party.toLowerCase() },
      transaction
    });
  }

  // Assume unknown party is non-partisan
  if (!party) {
    throw new Error(`Unable to find party: ${candidate.party}`);
  }

  // Some common values
  let id = `${parsedContest.contest.id}-${candidate.candidateid}`;

  // Create candidate record
  let candidateRecord = {
    id,
    name: id,
    party_id: party.get('id'),
    apId: candidate.candidateid,
    apIdHistory: { [election.get('id')]: candidate.candidateid },
    first: candidate.first,
    last: candidate.last,
    fullName: _.filter([candidate.first, candidate.last])
      .join(' ')
      .trim(),
    // TODO
    shortName: undefined,
    sort: _.filter([candidate.last, candidate.first])
      .join(', ')
      .trim()
      .toLowerCase(),
    sourceData: {
      'ap-elex': {
        about: 'Taken from results level data',
        data: candidate
      }
    }
  };

  return [
    await db.findOrCreateOne(models.Candidate, {
      where: { id: candidateRecord.id },
      defaults: candidateRecord,
      transaction
    })
  ];
}
