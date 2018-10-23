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

// AP level results
const apLevelResults = [
  'state',
  'us-house',
  'us-senate',
  'state-lower',
  'state-upper',
  'judicial',
  'judicial-district'
];

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

  // Get list of boundary id to check against
  let boundaryIds = await models.Boundary.findAll({
    attributes: ['id'],
    raw: true
  });
  boundaryIds = _.map(boundaryIds, 'id');

  // Records
  let records = [];

  // Go through files
  for (let file of files) {
    for (let ci in file.contests) {
      let c = file.contests[ci];

      // Exclude AP
      if (!argv.includeAp) {
        if (~apLevelResults.indexOf(file.type)) {
          continue;
        }
      }

      // Run through parser
      let parsed = await contestParser(c, {
        type: file.type,
        election,
        models
      });

      // Put together records
      if (parsed) {
        if (parsed.body) {
          records.push({
            model: models.Body,
            record: _.extend(parsed.body, {
              sourceData: {
                'mn-sos-ftp': {
                  about: 'Taken from results level data',
                  data: c
                }
              }
            })
          });
        }
        if (parsed.office) {
          // Check boundary Id
          if (parsed.office.boundary_id) {
            if (boundaryIds.indexOf(parsed.office.boundary_id) === -1) {
              debug(`Unable to find boundary ID: ${parsed.office.boundary_id}`);
              parsed.office.boundary_id = undefined;
            }
          }

          records.push({
            model: models.Office,
            record: _.extend(parsed.office, {
              sourceData: {
                'mn-sos-ftp': {
                  about: 'Taken from results level data',
                  data: c
                }
              }
            })
          });
        }
        if (parsed.contest) {
          records.push({
            model: models.Contest,
            record: _.extend(parsed.contest, {
              sourceData: {
                'mn-sos-ftp': {
                  about: 'Taken from results level data',
                  data: c
                }
              }
            })
          });
        }
      }
    }
  }

  // Save records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
