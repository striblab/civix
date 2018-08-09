/**
 * Get candidates from AP
 */

// Dependencies
const _ = require('lodash');
const Elex = require('../../lib/elex.js').Elex;
const ensureElexSource = require('./source-ap-elex.js');

// Import function
module.exports = async function coreDataElexRacesImporter({
  logger,
  models,
  db
}) {
  logger('info', 'AP (via Elex) Candidates importer...');
  let updates = [];

  // Election information
  const electionString = '2018-08-14';
  const electionDate = new Date(electionString);
  const electionDateId = electionString.replace(/-/g, '');
  const electionRecord = {
    id: `mn-${electionDateId}`,
    name: `mn-${electionDateId}`,
    title: `Minnesota Primary ${electionString}`,
    shortTitle: 'MN Primary',
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
  const elex = new Elex({ logger, defaultElection: electionString });
  const candidates = await elex.results();

  // Create transaction
  const transaction = await db.sequelize.transaction();

  // Wrap to catch any issues and rollback
  try {
    // Gather results
    let results = [];

    // Make common source
    let sourceResult = await ensureElexSource({ models, transaction });
    results.push(sourceResult);
    let source = sourceResult[0];

    // Create election
    let electionResult = await db.findOrCreateOne(models.Election, {
      where: { id: electionRecord.id },
      defaults: electionRecord,
      transaction
    });
    results.push(electionResult);
    let election = electionResult[0];

    // Import candidates
    results = results.concat(
      await importCandidates({
        candidates,
        db,
        transaction,
        models,
        source,
        election
      })
    );

    // Log changes
    _.filter(
      results.forEach(u => {
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
  }
};

// Import candidates
async function importCandidates({
  candidates,
  db,
  transaction,
  models,
  source,
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
        transaction,
        source
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
  transaction,
  source
}) {
  let original = _.cloneDeep(candidate);

  // Unsure best way to only find top level results, but
  // this seems to work
  if (candidate.level !== 'state' && candidate.level !== null) {
    return [];
  }

  // Get party

  // Get party.  AP doesn't use DFL, though it should
  let party;
  if (candidate.party.toLowerCase() === 'dem') {
    party = await models.Party.findOne({
      where: { id: 'dfl' },
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
    party = await models.Party.findOne({
      where: { id: 'np' },
      transaction
    });
  }

  // Create candidate record
  let candidateRecord = {
    id: db.makeIdentifier([
      election.get('id'),
      candidate.candidateid,
      candidate.last
    ]),
    name: db.makeIdentifier([
      election.get('id'),
      candidate.candidateid,
      candidate.last
    ]),
    party_id: party.get('id'),
    apId: candidate.candidateid,
    apIdHistory: { [election.get('id')]: candidate.candidateid },
    first: candidate.first,
    last: candidate.last,
    fullName: _
      .filter([candidate.first, candidate.last])
      .join(' ')
      .trim(),
    // TODO
    shortName: undefined,
    sort: _
      .filter([candidate.last, candidate.first])
      .join(', ')
      .trim()
      .toLowerCase(),
    sourceData: {
      [source.get('id')]: {
        data: original
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
