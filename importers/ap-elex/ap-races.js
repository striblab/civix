/**
 * Get races for an election
 */

// Dependencies
const _ = require('lodash');
const Elex = require('../../lib/elex.js').Elex;
const ensureElexSource = require('./source-ap-elex.js');

// Import function
module.exports = async function coreDataElexRacesImporter({
  logger,
  models,
  db
}) {
  logger('info', 'AP (via Elex) Races importer...');

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

  // Get elex races
  // TODO: Get election from argv
  const elex = new Elex({ logger, defaultElection: electionString });
  const races = await elex.races();

  // Create transaction
  const transaction = await db.sequelize.transaction();

  // Wrap to catch any issues and rollback
  try {
    // Gather results
    let results = [];

    // Make common source
    let sourceResult = await ensureElexSource({ models, transaction });
    results.push(sourceResult);
    let source = sourceResult[0];

    // Create election
    let electionResult = await db.findOrCreateOne(models.Election, {
      where: { id: electionRecord.id },
      defaults: electionRecord,
      transaction
    });
    results.push(electionResult);
    let election = electionResult[0];

    // Make contests (AP calls them races)
    results = results.concat(
      await importContests({
        races,
        db,
        transaction,
        models,
        source,
        election
      })
    );

    // Log changes
    _.filter(
      results.forEach(u => {
        logger(
          'info',
          `[${u[0].constructor.name}] ${u[1] ? 'Created' : 'Existed'}: ${
            u[0].dataValues.id
          }`
        );
      })
    );

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
  races,
  db,
  models,
  transaction,
  source,
  election
}) {
  let results = [];

  for (let r of races) {
    results = results.concat(
      await importContest({
        election,
        race: r,
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
  race,
  db,
  models,
  transaction,
  source
}) {
  let original = _.cloneDeep(race);
  let results = [];

  // Get party.  AP doesn't use DFL, though it should
  let party;
  if (race.party.toLowerCase() === 'dem') {
    party = await models.Party.findOne({
      where: { id: 'dfl' },
      transaction
    });
  }
  else {
    party = await models.Party.findOne({
      where: { apId: race.party.toLowerCase() },
      transaction
    });
  }

  // Senate races are in a class and can be special
  // https://en.wikipedia.org/wiki/List_of_United_States_Senators_from_Minnesota
  if (race.officeid === 'S') {
    if (race.seatname) {
      race.special = true;
    }

    if (
      (new Date(election.get('date')).getYear() - 2000) % 6 !== 0 &&
      !race.special
    ) {
      race.seatname = 'Class 1';
    }
    else {
      race.seatname = 'Class 2';
    }
  }

  // The Oth party is used for other parties in partisan
  // primaries, as well as for
  race.partisan = true;
  if (race.officename.match(/district\s+court/i)) {
    race.partisan = false;
  }

  // If partisan race and party Oth, throw away
  if (race.party.match(/^oth$/i) && race.partisan) {
    return new Promise(resolve => resolve([]));
  }

  // Parse out district court
  if (race.officename.match(/district\s+court/i)) {
    let s = race.seatname;
    race.seatname = s.replace(/^([0-9]+),\s+(seat\s+[0-9]+)/i, '$1');
    race.subseatname = s.replace(/^[0-9]+,\s+(seat\s+[0-9]+)/i, '$1');
    race.districtcourt = true;
  }

  // Parse out statewides that should be marked, but
  // are not
  if (race.officename.match(/^auditor$/i)) {
    race.statewide = true;
  }

  // Identifiers
  let officeId = db.makeIdentifier([
    race.statepostal,
    race.officename,
    race.seatname,
    race.subseatname
  ]);
  let contestId = db.makeIdentifier([
    election.get('id'),
    race.officename,
    race.seatname,
    race.subseatname,
    race.partisan && party ? party.get('id') : undefined
  ]);

  //console.log(race.officename, '-', race.seatname, '-', race.subseatname);

  // Known body types
  // http://customersupport.ap.org/doc/AP_Elections_API_Developer_Guide.pdf
  let body;
  if (~['H', 'S', 'Y', 'Z'].indexOf(race.officeid) || race.districtcourt) {
    body = {
      id: db.makeIdentifier([race.statepostal, race.officename]),
      name: db.makeIdentifier([race.statepostal, race.officename]),
      title: race.officename,
      sort: db.makeSort(race.officename),
      stateCode: race.statepostal.toLowerCase(),
      sourceData: {
        [source.get('id')]: {
          data: original
        }
      }
    };
  }

  // Known boundaries
  let boundary;
  if (~['H', 'Y', 'Z'].indexOf(race.officeid)) {
    boundary = {
      id: officeId,
      name: officeId,
      title: [race.officename, race.seatname].join(' '),
      sort: db.makeSort([race.officename, race.seatname].join(' ')),
      division_id: {
        H: 'country',
        S: 'country',
        Y: 'state-lower',
        Z: 'state-upper'
      }[race.officeid],
      parent_id: {
        H: `state-${race.statepostal.toLowerCase()}`,
        Y: `state-${race.statepostal.toLowerCase()}`,
        Z: `state-${race.statepostal.toLowerCase()}`
      }[race.officeid],
      sourceData: {
        [source.get('id')]: {
          data: original
        }
      }
    };
  }
  else if (race.districtcourt) {
    boundary = {
      id: db.makeIdentifier([race.statepostal, race.officename, race.seatname]),
      name: db.makeIdentifier([
        race.statepostal,
        race.officename,
        race.seatname
      ]),
      title: [race.officename, race.seatname].join(' '),
      sort: db.makeSort([race.officename, race.seatname].join(' ')),
      division_id: 'judicial',
      parent_id: 'state-mn',
      sourceData: {
        [source.get('id')]: {
          data: original
        }
      }
    };
  }

  // Office
  let office = {
    id: officeId,
    name: officeId,
    title: _
      .filter([race.officename, race.seatname, race.subseatname])
      .join(' '),
    shortTitle: _
      .filter([
        race.seatname && race.seatname.match(/^[0-9]+$/)
          ? `District ${race.seatname}`
          : race.seatname,
        race.subseatname
      ])
      .join(' '),
    sort: db.makeSort(
      _.filter([race.officename, race.seatname, race.subseatname]).join(' ')
    ),
    seatName: race.subseatname,
    // Has boundary
    boundary_id: boundary
      ? boundary.id
      : // Other known state wide
      race.statewide
        ? `state-${race.statepostal.toLowerCase()}`
        : // Known state level
        {
          S: `state-${race.statepostal.toLowerCase()}`,
          G: `state-${race.statepostal.toLowerCase()}`,
          A: `state-${race.statepostal.toLowerCase()}`,
          R: `state-${race.statepostal.toLowerCase()}`
        }[race.officeid],
    body_id: body ? body.id : undefined,
    sourceData: {
      [source.get('id')]: {
        data: original
      }
    }
  };

  // Contest
  let contest = {
    election_id: election.get('id'),
    office_id: office.id,
    party_id: party ? party.get('id') : undefined,
    id: contestId,
    name: contestId,
    title: _
      .filter([
        race.officename,
        race.seatname,
        race.subseatname,
        party ? party.get('title') : undefined
      ])
      .join(' '),
    shortTitle: _
      .filter(
        party
          ? [party.get('shortTitle') || party.get('title'), 'Primary']
          : [
            race.seatname.match(/^[0-9]+$/)
              ? `District ${race.seatname}`
              : race.seatname,
            race.subseatname
          ]
      )
      .join(' '),
    sort: db.makeSort(
      _
        .filter([
          race.officename,
          race.seatname,
          race.subseatname,
          party ? party.get('title') : undefined
        ])
        .join(' ')
    ),
    localId: undefined,
    apId: race.id,
    type: 'primary',
    special: race.special,
    elect: race.partisan ? 1 : 2,
    uncontested: race.uncontested,
    partisan: race.partisan,
    question: race.officeid === 'I',
    questionTitle: undefined,
    questionText: undefined,
    voteType: undefined,
    reporting: undefined,
    totalPrecincts: undefined,
    totalVotes: undefined,
    sourceData: {
      [source.get('id')]: {
        data: original
      }
    }
  };

  // Put together
  if (body) {
    results.push(
      await db.findOrCreateOne(models.Body, {
        where: { id: body.id },
        defaults: body,
        transaction,
        include: []
      })
    );
  }
  if (boundary) {
    results.push(
      await db.findOrCreateOne(models.Boundary, {
        where: { id: boundary.id },
        defaults: boundary,
        transaction,
        include: []
      })
    );
  }
  if (office) {
    results.push(
      await db.findOrCreateOne(models.Office, {
        where: { id: office.id },
        defaults: office,
        transaction,
        include: []
      })
    );
  }
  if (contest) {
    results.push(
      await db.findOrCreateOne(models.Contest, {
        where: { id: contest.id },
        defaults: contest,
        transaction,
        include: []
      })
    );
  }

  return results;
}
