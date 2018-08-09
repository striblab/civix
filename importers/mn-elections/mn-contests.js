/**
 * Get contest from MN API, setting up contests and related data.
 */

// Dependencies
const _ = require('lodash');
const MNElections = require('../../lib/mn-elections.js').MNElections;
const ensureMNAPISource = require('./source-mn-sos-api.js');
const debug = require('debug')('civix:importer:mn-contests');

// Import function
module.exports = async function mnElectionsMNContestsImporter({
  logger,
  models,
  db
}) {
  logger('info', 'MN (via API) Contests importer...');

  // Election information
  const electionString = '2018-08-14';
  const electionDate = new Date(electionString);
  const electionDateId = electionString.replace(/-/g, '');
  const electionRecord = {
    id: `mn-${electionDateId}`,
    name: `mn-${electionDateId}`,
    title: `Minnesota Primary ${electionString}`,
    shortTitle: 'MN Primary',
    sort: `${electionDateId} minnesota primary`,
    date: electionDate,
    type: 'primary',
    boundary_id: 'state-mn',
    sourceData: {
      'civix-ap-elex': {
        manual: true
      }
    }
  };

  // Get elex candidates (via results)
  const mnElections = new MNElections({
    logger,
    defaultElection: electionDateId
  });
  const contests = await mnElections.results();

  // Create transaction
  const transaction = await db.sequelize.transaction();

  // Wrap to catch any issues and rollback
  try {
    // Gather results
    let results = [];

    // Make common source
    let sourceResult = await ensureMNAPISource({ models, transaction });
    results.push(sourceResult);
    let source = sourceResult[0];

    // Create election
    let electionRecordResults = await db.findOrCreateOne(models.Election, {
      where: { id: electionRecord.id },
      defaults: electionRecord,
      transaction
    });
    results.push(electionRecordResults);
    let election = electionRecordResults[0];

    // Import results
    results = results.concat(
      await importContests({
        contests,
        db,
        transaction,
        models,
        source,
        election
      })
    );

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

// Import contests
async function importContests({
  contests,
  db,
  models,
  transaction,
  source,
  election
}) {
  let results = [];

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

  // Ignore races that AP covers
  if (
    ~['state-house', 'state', 'us-senate', 'us-house', 'judicial'].indexOf(
      contest.type
    )
  ) {
    return [];
  }

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
      fullName: _
        .filter([
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
      sort: _
        .filter([candidate.last, candidate.first])
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
