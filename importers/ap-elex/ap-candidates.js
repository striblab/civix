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
  logger('info', 'Core data: Boundary: Elex Races importer...');
  let updates = [];

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
    // results = results.concat(
    //   await importContests({
    //     races,
    //     db,
    //     transaction,
    //     models,
    //     source,
    //     election
    //   })
    // );

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
