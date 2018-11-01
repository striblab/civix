/**
 * Determine trends manually from data.  This assumes data
 * is loaded into the database.
 */

// Dependencies
const _ = require('lodash');
const { makeSort } = require('../../lib/strings.js');
const { importRecords } = require('../../lib/importing.js');

// Import function
module.exports = async function coreDataElexRacesImporter({
  logger,
  models,
  db,
  config,
  argv
}) {
  // Configuration
  const trendConfig = {
    // Election
    'usa-mn-20181106': {
      // Body
      'usa-mn-state-lower': {
        // Will fail if goes over
        total: 134,
        // Holdover define what parties will get entries
        holdovers: {
          rep: 0,
          dfl: 0
        },
        current: {
          rep: 76,
          dfl: 55
        }
      },
      'usa-mn-state-upper': {
        total: 67,
        holdovers: {
          rep: 33,
          dfl: 33
        },
        current: {
          rep: 33,
          dfl: 33
        }
      }
    }
  };

  // Make sure election is given
  if (!argv.election) {
    throw new Error(
      'An election argument must be provided, for example --election="2018-11-06"'
    );
  }

  // Make sure state is given
  if (!argv.state) {
    throw new Error(
      'An state argument must be provided, for example --election="mn"'
    );
  }

  // Warn if we have the zero flag
  if (argv.zero) {
    logger.info(
      '--zero flag enabled; ALL RESULTS AND PRECINCTS WILL BE ZERO AND WINNERS WILL BE SET TO FALSE.'
    );
  }

  // Get election
  let election = await models.Election.findOne({
    where: {
      id: `usa-${argv.state}-${argv.election.replace(/-/g, '')}`
    }
  });
  if (!election) {
    throw new Error(`Unable to find election: ${argv.state}-${argv.election}`);
  }

  // Records for db
  let records = [];

  // Find record
  let bodies = trendConfig[election.get('id')];
  if (!bodies) {
    logger.info(
      `Unable to find configuration for election: ${election.get('id')}`
    );
    return;
  }

  // Get parties
  let parties = await models.Party.findAll();
  parties = _.keyBy(parties, 'id');

  // Go through each body
  for (let bodyId in bodies) {
    let trendInfo = bodies[bodyId];

    // Get office data, since that's where
    let offices = await models.Office.findAll({
      where: {
        body_id: bodyId
      },
      include: [
        // Default all does not get nested parts
        {
          all: true,
          attributes: { exclude: ['sourceData'] }
        },
        // Contests and results
        {
          model: models.Contest,
          attributes: { exclude: ['sourceData'] },
          include: [
            {
              model: models.Result,
              attributes: { exclude: ['sourceData'] },
              include: [
                {
                  model: models.Candidate,
                  attributes: { exclude: ['sourceData'] },
                  include: [
                    {
                      model: models.Party,
                      attributes: { exclude: ['sourceData'] }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    // Simplify
    offices = _.map(offices, c => {
      return c.get({ plain: true });
    });

    // Clear out any sub contests
    offices = _.map(offices, o => {
      o.contests = _.filter(o.contests, c => {
        return c && !c.parent_id;
      });

      return o;
    });

    // Make sure we only have contests for this election, and parent
    offices = _.filter(offices, o => {
      return (
        o.contests &&
        o.contests.length === 1 &&
        o.contests[0].election_id === election.get('id')
      );
    });

    // Pull out body
    let body = offices[0].body;

    // Group by party if there is a winner
    let groups = _.groupBy(offices, o => {
      let winner = _.find(o.contests[0].results, { winner: true });
      if (winner) {
        return winner.candidate.party_id;
      }

      return 'no-winner';
    });
    let winnerCounts = _.mapValues(groups, g => g.length || 0);

    // Check some records
    if (
      offices.length + _.sum(_.map(trendInfo.holdovers)) !==
      trendInfo.total
    ) {
      throw new Error(
        `Offices found and holdovers do not add to total for ${bodyId}: Offices: ${
          offices.length
        } Trend info: ${JSON.stringify(trendInfo)}`
      );
    }

    // Go through each party
    _.each(trendInfo.holdovers, (holdover, partyId) => {
      if (!partyId || partyId === 'no-winner') {
        return;
      }
      let count = winnerCounts[partyId] || 0;
      let party = parties[partyId];

      // Create record
      let trendRecord = {
        id: `${body.id}-${party.id}`,
        name: `${body.id}-${party.id}`,
        title: `${body.title} ${party.title} Seats`,
        shortTitle: `${party.shortTitle || party.title} Seats`,
        sort: makeSort(`${body.title} ${party.title} Seat`),
        won: argv.zero ? 0 : count,
        holdovers: trendInfo.holdovers[partyId] || 0,
        current: trendInfo.current[partyId] || 0,
        // netWinners: argv.zero ? 0 : parseInteger(trend.net_winners),
        // netLeaders: argv.zero ? 0 : parseInteger(trend.net_leaders),
        election_id: election.get('id'),
        body_id: body.id,
        party_id: party.id,
        test: config.testResults,
        sourceData: {
          manual: {
            about: 'Calculated from database'
          }
        }
      };

      records.push({
        model: models.Trends,
        record: trendRecord
      });
    });
  }

  // Import records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
