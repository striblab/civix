/**
 * Get results from AP.  This updates existing data.
 */

// Dependencies
const _ = require('lodash');
const Elex = require('../../lib/elex.js').Elex;
const contestParser = require('./lib/ap-elex-contests.js');

// Import function
module.exports = async function coreDataElexRacesImporter({
  logger,
  models,
  db,
  config,
  argv
}) {
  logger('info', 'AP (via Elex) Results importer...');

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
  let results = await elex.results();

  // Create transaction
  const transaction = await db.sequelize.transaction();

  // Wrap to catch any issues and rollback
  try {
    // Gather results
    let dbResults = [];

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
    results = _.filter(results, r => {
      return (
        r.statepostal === argv.state.toUpperCase() &&
        r.reportingunitid.match(/^state/i)
      );
    });

    // Import results
    dbResults = dbResults.concat(
      await importResults({
        results,
        db,
        transaction,
        models,
        election,
        config
      })
    );

    // Log changes
    _.filter(dbResults).forEach(u => {
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
    process.exit(1);
  }
};

// Import candidates
async function importResults({
  results,
  db,
  transaction,
  models,
  election,
  config
}) {
  let importResults = [];

  // Do top-level results first
  for (let result of results) {
    importResults = importResults.concat(
      await importResult({
        election,
        result,
        db,
        models,
        transaction,
        config
      })
    );
  }

  return importResults;
}

// Import single candidate
async function importResult({
  election,
  result,
  db,
  models,
  transaction,
  config
}) {
  let importResults = [];

  // Parse out some of the high level data and Ids
  let parsedContest = contestParser(result, { election });

  // Candidate id
  let candidateId = `${parsedContest.contest.id}-${result.candidateid}`;

  // Don't get candidate or contest record for speed

  // Make default id
  let resultId = candidateId;

  // If county, make parent id
  // if (isCounty) {
  //   resultId = db.makeIdentifier([resultId, result.fipscode]);

  //   let boundaryVersion = await models.BoundaryVersion.findOne({
  //     where: { fips: result.fipscode.replace(/^27/, '') },
  //     transaction,
  //     include: []
  //   });
  //   if (boundaryVersion) {
  //     boundaryVersionId = boundaryVersion.get('id');
  //   }
  // }

  // Create result record
  let resultRecord = {
    id: resultId,
    contest_id: parsedContest.contest.id,
    candidate_id: candidateId,
    apId: result.id,
    apUpdated: result.lastupdated ? new Date(result.lastupdated) : undefined,
    units: undefined,
    votes: result.votecount,
    percent: result.votepct,
    winner: result.winner,
    incumbent: result.incumbent,
    test: config.testResults,

    //subResult: isCounty ? true : false,
    // resultDetails: isCounty
    //   ? {
    //     reporting: result.precinctsreporting,
    //     totalPrecincts: result.precinctstotal
    //   }
    //   : undefined,
    //boundary_version_id: boundaryVersionId ? boundaryVersionId : undefined,
    //division_id: isCounty ? result.level : undefined,

    sourceData: {
      'ap-elex': {
        data: result
      }
    }
  };

  // TODO: Support update only option
  importResults.push(
    await db.updateOrCreateOne(models.Result, {
      where: { id: resultRecord.id },
      defaults: resultRecord,
      pick: [
        'test',
        'winner',
        'votes',
        'percent',
        'apUpdated',
        'sourceData',
        'resultDetails'
      ],
      transaction,
      include: []
    })
  );

  // Update contest
  //if (!isCounty) {
  await models.Contest.update(
    {
      reporting: result.precinctsreporting,
      totalPrecincts: result.precinctstotal
    },
    {
      where: { id: parsedContest.contest.id },
      transaction
    }
  );

  return importResults;
}
