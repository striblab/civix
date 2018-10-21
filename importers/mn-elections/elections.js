/**
 * Get elections from MN API.
 */

// Dependencies
const _ = require('lodash');
const MNElections = require('../../lib/mn-elections.js').MNElections;
const { makeSort } = require('../../lib/strings.js');
const { importRecords } = require('../../lib/importing.js');

// Import function
module.exports = async function mnElectionsMNContestsImporter({
  logger,
  models,
  db,
  argv
}) {
  logger('info', 'MN Elections API: Elections...');

  // Get elex candidates (via results)
  const mnElections = new MNElections({
    logger
  });
  const elections = await mnElections.elections();

  // Collect records to save
  let records = [];

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
      // For date-only fields, pass a string, if use a JS Date, the time zone will
      // probably affect it.
      date: dateString,
      type: election.primary ? 'primary' : 'general',
      special: _.isBoolean(election.special) ? election.special : undefined,
      boundary_id: 'usa-state-mn',
      sourceData: {
        'mn-elections-api': {
          url: 'https://github.com/striblab/mn-elections-api',
          data: election
        }
      }
    };

    records.push({ model: models.Election, record: electionRecord });
  }

  // Import records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
