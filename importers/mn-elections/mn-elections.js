/**
 * Get elections from MN API.
 */

// Dependencies
const _ = require('lodash');
const MNElections = require('../../lib/mn-elections.js').MNElections;
const { makeSort } = require('../../lib/strings.js');
const debug = require('debug')('civix:importer:mn-contests');

// Import function
module.exports = async function mnElectionsMNContestsImporter({
  logger,
  models,
  db
}) {
  logger('info', 'MN Elections API: Elections...');

  // Get elex candidates (via results)
  const mnElections = new MNElections({
    logger
  });
  const elections = await mnElections.elections();

  // Create transaction
  const transaction = await db.sequelize.transaction();

  // Wrap to catch any issues and rollback
  try {
    // Gather results
    let results = [];

    // Go through and make election entries
    for (let ei in elections) {
      let election = elections[ei];
      election.id = election.id || ei;
      let dateString = election.id.replace(
        /^([0-9]{4})([0-9]{2})([0-9]{2})$/,
        '$1-$2-$3'
      );
      let title = `Minnesota ${election.special ? 'Special ' : ''}${
        election.primary ? 'Primary' : 'General'
      } ${dateString}`;
      let electionRecord = {
        id: `usa-mn-${election.id}`,
        name: `usa-mn-${election.id}`,
        title: title,
        shortTitle: `MN ${election.special ? 'Special ' : ''}${
          election.primary ? 'Primary' : 'General'
        }`,
        sort: makeSort(title),
        date: new Date(dateString),
        type: election.primary ? 'primary' : 'general',
        special: election.special,
        boundary_id: 'usa-state-mn',
        sourceData: {
          'mn-elections-api': {
            url: 'https://github.com/striblab/mn-elections-api',
            data: election
          }
        }
      };

      results.push(
        await db.findOrCreateOne(models.Election, {
          transaction,
          where: { id: electionRecord.id },
          defaults: electionRecord
        })
      );
    }

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
