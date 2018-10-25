/**
 * Get candidates from AP
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
  let { data: results, cached } = await elex.results();

  // If cached, then there's no reason to do anything
  if (cached && !argv.ignoreCache) {
    logger.info('Elex results was cached, no need to do anything.');
    return;
  }

  // Records for db
  let records = [];

  // Get election
  let election = await models.Election.findOne({
    where: {
      id: `usa-${argv.state}-${argv.election.replace(/-/g, '')}`
    }
  });
  if (!election) {
    throw new Error(`Unable to find election: ${argv.state}-${argv.election}`);
  }

  // Filter candidates to just the top level
  let candidates = _.filter(results, r => {
    return (
      r.statepostal === argv.state.toUpperCase() &&
      r.reportingunitid.match(/^state/i)
    );
  });

  for (let candidate of candidates) {
    // Parse out some of the high level data and Ids
    let parsedContest = contestParser(candidate, { election });

    // Get party.  AP doesn't use DFL, though it should
    let party;
    if (candidate.party.toLowerCase() === 'dem') {
      party = await models.Party.findOne({
        where: { id: 'dfl' }
      });
    }
    // No party
    else if (
      candidate.party.toLowerCase() === 'una' ||
      candidate.party.toLowerCase() === 'np'
    ) {
      party = await models.Party.findOne({
        where: { id: 'np' }
      });
    }
    else {
      party = await models.Party.findOne({
        where: { apId: candidate.party.toLowerCase() }
      });
    }

    // Throw if no party found
    if (!party) {
      throw new Error(`Unable to find party: ${candidate.party}`);
    }

    // Some common values
    let id = `${parsedContest.contest.id}-${candidate.candidateid}`;

    // Create candidate record
    let candidateRecord = {
      id,
      name: id,
      party_id: party.get('id'),
      apId: candidate.candidateid,
      apIdHistory: { [election.get('id')]: candidate.candidateid },
      first: candidate.first,
      last: candidate.last,
      fullName: _.filter([candidate.first, candidate.last])
        .join(' ')
        .trim(),
      // TODO
      shortName: undefined,
      sort: _.filter([candidate.last, candidate.first])
        .join(', ')
        .trim()
        .toLowerCase(),
      sourceData: {
        'ap-elex': {
          about: 'Taken from results level data',
          data: candidate
        }
      }
    };

    records.push({
      model: models.Candidate,
      record: candidateRecord
    });
  }

  // Import records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
