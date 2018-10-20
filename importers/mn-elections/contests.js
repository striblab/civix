/**
 * Get contest from MN API, setting up contests and related data.
 */

// Dependencies
const _ = require('lodash');
const MNElections = require('../../lib/mn-elections.js').MNElections;
const moment = require('moment-timezone');
const debug = require('debug')('civix:importer:mn-contests');

// Import function
module.exports = async function mnElectionsMNContestsImporter({
  logger,
  models,
  db,
  argv
}) {
  logger('info', 'MN (via API) Contests importer...');

  // Make sure election is given
  if (!argv.election) {
    throw new Error(
      'An election argument must be provided, for example --election="2018-11-06"'
    );
  }

  // Check for ignore AP level
  if (argv.ignoreAp) {
    logger('info', 'Ignoring API level data.');
  }

  // Create transaction
  const transaction = await db.sequelize.transaction();

  // Wrap to catch any issues and rollback
  try {
    // Gather results
    let importResults = [];

    // Get election
    let election = await models.Election.findOne({
      where: {
        id: `usa-mn-${argv.election.replace(/-/g, '')}`
      }
    });
    if (!election) {
      throw new Error(
        `Unable to find election: ${argv.state}-${argv.election}`
      );
    }

    // Get mn-elections-api contests
    const mnElections = new MNElections({
      logger,
      defaultElection: moment(election.get('date')).format('YYYYMMDD')
    });
    const contests = await mnElections.results();

    // Import results
    importResults = importResults.concat(
      await importContests({
        contests,
        db,
        transaction,
        models,
        election,
        argv
      })
    );

    // Log changes
    _.filter(importResults).forEach(u => {
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

// Import contests
async function importContests({
  contests,
  db,
  models,
  transaction,
  source,
  election,
  argv
}) {
  let results = [];

  // Filter out any type that are from the AP
  if (argv.ignoreAp) {
    contests = _.filter(contests, c => {
      return (
        [
          'state-house',
          'state-enate',
          'state',
          'us-senate',
          'us-house',
          'judicial',
          'judicial-district'
        ].indexOf(c.type) === -1
      );
    });
  }

  console.log(contests);
  sdfsdfdf();

  for (let contest of contests) {
    results = results.concat(
      await importContest({
        election,
        contest,
        db,
        models,
        transaction,
        source
      })
    );
  }

  return results;
}

// Import specific race
async function importContest({
  election,
  contest,
  db,
  models,
  transaction,
  source
}) {
  let original = _.cloneDeep(contest);
  let results = [];

  // TODO: Body
  let body;

  // Boundary
  // TODO: API fix: (note that wards and districts are not marked in data)
  let boundaryId = db.makeIdentifier([
    contest.state,
    contest.type,
    contest[_.camelCase(contest.type)]
  ]);
  let boundary = {
    id: boundaryId,
    name: boundaryId,
    title: _.filter([contest.area, contest.subArea]).join(' '),
    stateCode: 'mn',
    division_id: contest.type === 'local' ? 'county-local' : contest.type,
    sourceData: {
      [source.get('id')]: {
        data: _.omit(original, ['candidates'])
      }
    }
  };

  // TODO: BoundaryVersion?

  // Office
  // TODO: Fix election replacement
  let officeId = db.makeIdentifier(['mn', contest.id.replace(/20180814-/, '')]);
  let officeTitleParts = [
    contest.area,
    contest.name,
    contest.subArea,
    contest.seatName
  ];
  let office = {
    id: officeId,
    name: officeId,
    title: _.filter(officeTitleParts).join(' '),
    sort: db.makeSort(_.filter(officeTitleParts).join(' ')),
    seatName: contest.seatName,
    boundary_id: boundary.id,
    body_id: body ? body.id : undefined,
    sourceData: {
      [source.get('id')]: {
        data: _.omit(original, ['candidates'])
      }
    }
  };

  // Contest
  let contestRecord;
  if (contest.nonpartisan) {
    contestRecord = {
      election_id: election.get('id'),
      office_id: office.id,
      id: db.makeIdentifier(['mn', contest.id]),
      name: db.makeIdentifier(['mn', contest.id]),
      title: _.filter(officeTitleParts).join(' '),
      sort: db.makeSort(_.filter(officeTitleParts).join(' ')),
      localId: contest.id,
      type: contest.ranked
        ? contest.special
          ? 'special'
          : 'general'
        : 'primary',
      special: contest.special,
      elect: contest.seats || 1,
      uncontested: contest.uncontested,
      partisan: !contest.nonpartisan,
      question: !!contest.questionTitle || !!contest.questionText,
      questionTitle: contest.questionTitle,
      questionText: contest.questionText,
      voteType: contest.ranked ? 'ranked-choice' : undefined,
      reporting: undefined,
      totalPrecincts: undefined,
      totalVotes: undefined,
      sourceData: {
        [source.get('id')]: {
          data: _.omit(original, ['candidates'])
        }
      }
    };
  }
  else {
    debug(contest);
  }

  // Candidates
  let candidates = contest.candidates.map(candidate => {
    return {
      id: db.makeIdentifier(['mn', candidate.id]),
      name: db.makeIdentifier(['mn', candidate.id]),
      party_id: candidate.party.toLowerCase(),
      localId: candidate.id,
      first: candidate.first || '',
      last: candidate.last || '',
      middle: candidate.middle,
      prefix: candidate.prefix,
      suffix: candidate.suffix,
      fullName: _.filter([
        candidate.prefix,
        candidate.first,
        candidate.middle,
        candidate.last,
        candidate.suffix ? `, ${candidate.suffix}` : null
      ])
        .join(' ')
        .trim(),
      // TODO
      shortName: undefined,
      sort: _.filter([candidate.last, candidate.first])
        .join(', ')
        .trim()
        .toLowerCase(),
      sourceData: {
        [source.get('id')]: {
          data: candidate
        }
      }
    };
  });

  // Create
  results.push(
    await db.findOrCreateOne(models.Boundary, {
      where: { id: boundary.id },
      defaults: boundary,
      transaction,
      include: []
    })
  );
  results.push(
    await db.findOrCreateOne(models.Office, {
      where: { id: office.id },
      defaults: office,
      transaction,
      include: []
    })
  );
  results.push(
    await db.findOrCreateOne(models.Contest, {
      where: { id: contestRecord.id },
      defaults: contestRecord,
      transaction,
      include: []
    })
  );

  for (let candidate of candidates) {
    results.push(
      await db.findOrCreateOne(models.Candidate, {
        where: { id: candidate.id },
        defaults: candidate,
        transaction,
        include: []
      })
    );
  }

  return results;
}
