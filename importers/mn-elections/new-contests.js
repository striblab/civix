/**
 * Get contest from MN API, setting up contests and related data.
 */

// Dependencies
const _ = require('lodash');
const moment = require('moment-timezone');
const { importRecords } = require('../../lib/importing.js');
const { getFiles } = require('./lib/election-files.js');
const contestParser = require('./lib/parse-contests.js');
const debug = require('debug')('civix:importer:mn-contests');

// Import function
module.exports = async function mnElectionsMNContestsImporter({
  logger,
  models,
  db,
  argv
}) {
  logger('info', 'MN SoS Contests importer...');

  // Make sure election is given
  if (!argv.election) {
    throw new Error(
      'An election argument must be provided, for example --election="2018-11-06"'
    );
  }

  // By default, ignore AP
  if (argv.includeAp) {
    logger('info', 'Including AP level contests.');
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

  // Get files
  let files = await getFiles(election.get('date'));

  // Records
  let records = [];

  // Go through files
  _.each(files, file => {
    _.each(file.contests, c => {
      let parsed = contestParser(c, { type: file.type, election });
      console.log(parsed);
    });
  });
};
