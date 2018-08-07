/**
 * Get results from AP.  This updates existing data.
 */

// Dependencies
const _ = require('lodash');
const Elex = require('../../lib/elex.js').Elex;
const ensureElexSource = require('./source-ap-elex.js');
const debug = require('debug')('civix:importer:ap-results');

// Import function
module.exports = async function coreDataElexRacesImporter({
  logger,
  models,
  db,
  config
}) {
  logger('info', 'AP (via Elex) Results importer...');

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
  const elex = new Elex({ logger, defaultElection: electionString });
  const electionResults = await elex.results();

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
    let electionRecordResults = await db.findOrCreateOne(models.Election, {
      where: { id: electionRecord.id },
      defaults: electionRecord,
      transaction
    });
    results.push(electionRecordResults);
    let election = electionRecordResults[0];

    // Import results
    results = results.concat(
      await importResults({
        electionResults,
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

// Import candidates
async function importResults({
  electionResults,
  db,
  transaction,
  models,
  source,
  election,
  config
}) {
  let results = [];

  // Do top-level results first
  for (let result of electionResults) {
    if (result.level === 'state' || result.level === null) {
      results = results.concat(
        await importResult({
          election,
          result,
          db,
          models,
          transaction,
          source,
          config
        })
      );
    }
  }

  // Then do county
  for (let result of electionResults) {
    if (result.level === 'county') {
      results = results.concat(
        await importResult({
          election,
          result,
          db,
          models,
          transaction,
          source,
          isCounty: true,
          config
        })
      );
    }
  }

  return results;
}

// Import single candidate
async function importResult({
  election,
  result,
  db,
  models,
  transaction,
  source,
  isCounty,
  config
}) {
  let original = _.cloneDeep(result);
  let results = [];

  // Get candidate record
  let candidate = await models.Candidate.findOne({
    where: { apId: result.candidateid },
    transaction,
    include: []
  });
  if (!candidate) {
    debug(result);
    throw new Error(`Unable to find candidate: ${result.candidateid}`);
  }

  // Get contest record
  let contest = await models.Contest.findOne({
    where: { apId: result.raceid, election_id: election.get('id') },
    transaction,
    include: []
  });
  // There are some candidate results that are not in the results
  // set, but it seems to only be uncontested.
  if (!contest && !result.uncontested) {
    debug(result);
    throw new Error(`Unable to find contest: ${result.candidateid}`);
  }
  if (!contest) {
    return [];
  }

  // Make default id
  let resultId = db.makeIdentifier([
    contest.get('id'),
    result.candidateid,
    result.last
  ]);
  let boundaryVersionId;

  // If county, make parent id
  if (isCounty) {
    resultId = db.makeIdentifier([resultId, result.fipscode]);

    let boundaryVersion = await models.BoundaryVersion.findOne({
      where: { fips: result.fipscode.replace(/^27/, '') },
      transaction,
      include: []
    });
    if (boundaryVersion) {
      boundaryVersionId = boundaryVersion.get('id');
    }
  }

  // Create result record
  let resultRecord = {
    id: resultId,
    contest_id: contest.get('id'),
    candidate_id: candidate.get('id'),
    apId: result.id,
    apUpdated: result.lastupdated ? new Date(result.lastupdated) : undefined,
    units: undefined,
    votes: result.votecount,
    percent: result.votepct,
    winner: result.winner,
    incumbent: result.incumbent,
    test: config.testResults,
    subResult: isCounty ? true : false,
    boundary_version_id: boundaryVersionId ? boundaryVersionId : undefined,
    division_id: isCounty ? result.level : undefined,
    sourceData: {
      [source.get('id')]: {
        data: original
      }
    }
  };
  results.push(
    await db.updateOrCreateOne(models.Result, {
      where: { id: resultRecord.id },
      defaults: resultRecord,
      pick: ['test', 'winner', 'votes', 'percent', 'apUpdated', 'sourceData'],
      transaction,
      include: []
    })
  );

  // Update contest
  if (!isCounty) {
    results.push([
      await contest.update(
        {
          reporting: result.precinctsreporting,
          totalPrecincts: result.precinctstotal,
          sourceData: {
            [source.get('id')]: {
              data: original
            }
          }
        },
        {
          transaction,
          include: []
        }
      ),
      false
    ]);
  }

  return results;
}
