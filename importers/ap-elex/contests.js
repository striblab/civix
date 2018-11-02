/**
 * Get contests for an election
 *
 * Note that AP calls contests = races
 */

// Dependencies
const _ = require('lodash');
const Elex = require('../../lib/elex.js').Elex;
const contestParser = require('./lib/parse-contests.js');
const { importRecords } = require('../../lib/importing.js');

// Import function
module.exports = async function coreDataElexRacesImporter({
  logger,
  models,
  db,
  argv
}) {
  // Make sure election is given
  if (!argv.election) {
    throw new Error(
      'An election argument must be provided, for example: --election="2018-11-06"'
    );
  }

  // Make sure state is given
  if (!argv.state) {
    throw new Error(
      'An state argument must be provided, for example: --state="mn"'
    );
  }

  // Get results as results actually tell us if
  // a contest is partisan.
  const elex = new Elex({ logger, defaultElection: argv.election });
  let { data: results, cached } = await elex.results();

  // If cached, then there's no reason to do anything
  if (cached && !argv.ignoreCache) {
    logger.info('Elex results was cached, no need to do anything.');
    return;
  }

  // Get election
  let election = await models.Election.findOne({
    where: {
      id: `usa-${argv.state}-${argv.election.replace(/-/g, '')}`
    }
  });
  if (!election) {
    throw new Error(
      `Unable to find election: usa-${argv.state}-${argv.election.replace(
        /-/g,
        ''
      )}`
    );
  }

  // Filter contests to just the top level
  let contests = _.filter(results, r => {
    return (
      r.statepostal === argv.state.toUpperCase() &&
      r.ballotorder === 1 &&
      (!r.reportingunitid || r.reportingunitid.match(/^state/i))
    );
  });
  // And wonderfully, ap real results before data has duplicates
  // assuming because of county
  contests = _.uniqBy(contests, 'id');

  // Records for db
  let records = [];

  for (let contest of contests) {
    // Parse out parts
    let parsed = contestParser(contest, { election });

    // Put together
    if (parsed.body) {
      records.push({
        model: models.Body,
        record: _.extend(parsed.body, {
          sourceData: {
            'ap-elex': {
              data: contest
            }
          }
        })
      });
    }
    if (parsed.office) {
      records.push({
        model: models.Office,
        record: _.extend(parsed.office, {
          sourceData: {
            'ap-elex': {
              data: contest
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
            'ap-elex': {
              data: contest
            }
          }
        })
      });
    }
  }

  // Import records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
