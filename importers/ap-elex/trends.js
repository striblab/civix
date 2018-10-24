/**
 * Get trends from AP.
 */

// Dependencies
const Elex = require('../../lib/elex.js').Elex;
const { parseInteger, makeSort } = require('../../lib/strings.js');
const { importRecords } = require('../../lib/importing.js');

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

  // Make elex object
  const elex = new Elex({ logger, defaultElection: argv.election });

  // Manually do senate and house
  for (let trendType of ['senate', 'house']) {
    // Get elex trend data
    let trends = await elex.trends({ type: trendType });

    // Go through trends
    for (let trend of trends) {
      // Look for party
      let party;
      if (trend.party.match(/^oth/i)) {
        party = await models.Party.findOne({
          where: { id: 'oth' }
        });
      }
      else {
        party = await models.Party.findOne({
          where: { apId: trend.party.toLowerCase() }
        });
      }

      // Throw if no party found
      if (!party) {
        throw new Error(`Unable to find party: ${trend.party}`);
      }

      // Get body
      let bodyId = `usa-congress-${trendType}`;
      let body = await models.Body.findOne({
        where: { id: bodyId }
      });

      // Throw if no body found
      if (!body) {
        throw new Error(`Unable to find body: ${bodyId}`);
      }

      // Create record
      let trendRecord = {
        id: `${body.get('id')}-${party.get('id')}`,
        name: `${body.get('id')}-${party.get('id')}`,
        title: `${body.get('title')} ${party.get('title')} Seats`,
        shortTitle: `${party.get('shortTitle')} Seats`,
        sort: makeSort(`${body.get('title')} ${party.get('title')} Seats`),
        won: parseInteger(trend.won),
        leading: parseInteger(trend.leading),
        holdovers: parseInteger(trend.holdovers),
        winningTrend: parseInteger(trend.winning_trend),
        current: parseInteger(trend.current),
        insufficientVote: parseInteger(trend.insufficient_vote),
        netWinners: parseInteger(trend.net_winners),
        netLeaders: parseInteger(trend.net_leaders),
        election_id: election.get('id'),
        body_id: body.get('id'),
        party_id: party.get('id'),
        test: config.testResults,
        sourceData: {
          'ap-elex': {
            data: trend
          }
        }
      };

      records.push({
        model: models.Trends,
        record: trendRecord
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
