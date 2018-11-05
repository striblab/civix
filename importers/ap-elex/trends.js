/**
 * Get trends from AP.
 */

// Dependencies
const Elex = require('../../lib/elex.js').Elex;
const { download } = require('../../lib/download.js');
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
  // Manual test trend files
  const manualTestTrendFiles = {
    'usa-mn-20181106': {
      senate: '398f79b1f60940b38bca0cee1b7a46c9',
      house: '9fe8b0ef023541d8a07b6eac0e81915d'
    }
  };

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

  // Make elex object
  const elex = new Elex({ logger, defaultElection: argv.election });

  // Manually do senate and house
  for (let trendType of ['senate', 'house']) {
    let trendFile;
    // As per usuall, the AP API is stupid, and even a day before the election
    // there is no production endpoint for trends.
    //
    // This is also coupled wtih the fact that elex doesn't support Test
    // for tend files
    // https://github.com/newsdev/elex/issues/308
    //
    // So, if test, use a manual endpoint that we download
    if (
      config.testResults &&
      manualTestTrendFiles[election.get('id')] &&
      manualTestTrendFiles[election.get('id')][trendType]
    ) {
      let output = await download({
        url: `https://api.ap.org/v2/reports/${
          manualTestTrendFiles[election.get('id')][trendType]
        }?apiKey=${config.apAPIKey}&format=json`,
        output: `${manualTestTrendFiles[election.get('id')][trendType]}.json`,
        ttl: 1000 * 60 * 1.5
      });
      trendFile = output.outputFile;
    }

    // Get elex trend data
    let { data: trends, cached } = await elex.trends({
      type: trendType,
      trendFile
    });

    // If cached, then there's no reason to do anything
    if (cached && !argv.ignoreCache) {
      logger.info(`Trend cached for "${trendType}", no need to do anything.`);
      continue;
    }

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
        shortTitle: `${party.get('shortTitle') || party.get('title')} Seats`,
        sort: makeSort(`${body.get('title')} ${party.get('title')} Seats`),
        won: argv.zero ? 0 : parseInteger(trend.won),
        leading: argv.zero ? 0 : parseInteger(trend.leading),
        holdovers: parseInteger(trend.holdovers),
        winningTrend: argv.zero ? 0 : parseInteger(trend.winning_trend),
        current: parseInteger(trend.current),
        insufficientVote: argv.zero ? 0 : parseInteger(trend.insufficient_vote),
        netWinners: argv.zero ? 0 : parseInteger(trend.net_winners),
        netLeaders: argv.zero ? 0 : parseInteger(trend.net_leaders),
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
