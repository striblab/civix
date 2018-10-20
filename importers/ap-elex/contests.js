/**
 * Get contests for an election
 *
 * Note that AP calls contests = races
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
  argv
}) {
  logger('info', 'AP (via Elex) Races importer...');

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

    // Filter contests to just the top level
    let contests = _.filter(results, r => {
      return (
        r.statepostal === argv.state.toUpperCase() &&
        r.ballotorder === 1 &&
        r.reportingunitid.match(/^state/i)
      );
    });

    // Make contests (AP calls them races)
    importResults = importResults.concat(
      await importContests({
        contests,
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

// Import contests
async function importContests({
  contests,
  db,
  models,
  transaction,
  source,
  election
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
        source
      })
    );
  }

  return results;
}

// Import specific race
async function importContest({ election, contest, db, models, transaction }) {
  let results = [];

  // Parse out parts
  let parsed = contestParser(contest, { election });

  // Put together
  if (parsed.body) {
    results.push(
      await db.findOrCreateOne(models.Body, {
        where: { id: parsed.body.id },
        defaults: _.extend(parsed.body, {
          sourceData: {
            'ap-elex': {
              about: 'Taken from results level data',
              data: contest
            }
          }
        }),
        transaction
      })
    );
  }
  if (parsed.office) {
    results.push(
      await db.findOrCreateOne(models.Office, {
        where: { id: parsed.office.id },
        defaults: _.extend(parsed.office, {
          sourceData: {
            'ap-elex': {
              about: 'Taken from results level data',
              data: contest
            }
          }
        }),
        transaction
      })
    );
  }
  if (parsed.contest) {
    results.push(
      await db.findOrCreateOne(models.Contest, {
        where: { id: parsed.contest.id },
        defaults: _.extend(parsed.contest, {
          sourceData: {
            'ap-elex': {
              about: 'Taken from results level data',
              data: contest
            }
          }
        }),
        transaction,
        include: []
      })
    );
  }

  return results;
}