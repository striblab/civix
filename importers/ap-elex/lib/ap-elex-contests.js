/**
 * Parsing contests from AP (via Elex) data
 */

// Dependencies
const moment = require('moment-timezone');
const { makeSort, makeId } = require('../../../lib/strings.js');

// Main parsed
function parseRouter(data, options = {}) {
  console.log(
    `${data.racetypeid} || ${data.officeid} || ${data.officename} || ${
      data.seatnum
    } || ${data.seatname}`
  );

  // Big check
  if (
    data.officename.match(
      /auditor|attorney\s+general|governor|secretary.*state/i
    )
  ) {
    return parseStateLevelExecutive(data, options);
  }
  else if (data.officename.match(/supreme.*court|appeals.*court/i)) {
    return parseStateSupremeAppealsCourt(data, options);
  }
  else if (data.officename.match(/district.*court/i)) {
    return parseStateDistrictCourt(data, options);
  }
  else if (data.officename.match(/u.s..*house/i)) {
    console.log(parseUSHouse(data, options));
    return parseUSHouse(data, options);
  }
}

// State level executive contenst, such as governor
function parseStateLevelExecutive(data, options = {}) {
  let officeId = `usa-mn-${makeId(data.officename)}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}`;
  let title = `Minnesota ${data.officename}`;
  let shortTitle = data.officename;

  return {
    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: 'Minnesota',
      boundary_id: 'usa-state-mn'
    },

    contest: {
      id: contestId,
      name: contestId,
      title,
      shortTitle,
      sort: makeSort(title),
      description: data.description,
      localId: undefined,
      apId: data.raceid,
      type: parseContestType(data.racetypeid),
      // TODO: How to determine this
      special: false,
      // TODO: How to determine this
      elect: undefined,
      uncontested: data.uncontested,
      partisan: isParty(data.party),
      question: data.is_ballot_measure,
      // questionTitle: ,
      // questionText: ,
      voteType: undefined,
      reporting: null,
      totalPrecincts: data.precinctstotal,
      subContest: false,
      election_id: options.election.get('id')
    }
  };
}

// State level supreme or appeals court.  The Supreme court has a "Chief justice" seat,
// otherwise, its just numbered
function parseStateSupremeAppealsCourt(data, options = {}) {
  let bodyId = `usa-mn-${makeId(data.officename)}`;
  let officeId = `${bodyId}-${(data.seatnum || makeId(data.seatname)).padStart(
    2,
    '0'
  )}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}`;
  let title = `Minnesota ${data.officename} ${data.seatname.replace(
    /district/i,
    'Seat'
  )}`;
  let shortTitle = `${data.seatname.replace(/district/i, 'Seat')}`;

  return {
    body: {
      id: bodyId,
      name: bodyId,
      title: `Minnesota ${data.officename}`,
      shortTitle: data.officename,
      sort: makeSort(data.officename),
      stateCode: 'mn'
    },

    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: 'Minnesota',
      subArea: undefined,
      seatName: data.seatnum || data.seatname,
      boundary_id: 'usa-state-mn',
      body_id: bodyId
    },

    contest: {
      id: contestId,
      name: contestId,
      title,
      shortTitle,
      sort: makeSort(title),
      description: data.description,
      localId: (data.seatnum || makeId(data.seatname)).padStart(2, '0'),
      apId: data.raceid,
      type: parseContestType(data.racetypeid),
      special: false,
      elect: undefined,
      uncontested: data.uncontested,
      partisan: isParty(data.party),
      question: data.is_ballot_measure,
      voteType: undefined,
      reporting: null,
      totalPrecincts: data.precinctstotal,
      subContest: false,
      election_id: options.election.get('id')
    }
  };
}

// District court
function parseStateDistrictCourt(data, options = {}) {
  // Parse out district and seat
  let p = data.seatname.match(/([0-9]+),\s+seat\s+([0-9]+)/i);
  let district = p[1];
  let seat = p[2];

  let bodyId = `usa-mn-${makeId(data.officename)}`;
  let officeId = `${bodyId}-${district.padStart(2, '0')}-${seat.padStart(
    2,
    '0'
  )}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}`;
  let title = `Minnesota ${data.officename} District ${district} Seat ${seat}`;
  let shortTitle = `District ${district} Seat ${seat}`;

  return {
    body: {
      id: bodyId,
      name: bodyId,
      title: `Minnesota ${data.officename}`,
      shortTitle: data.officename,
      sort: makeSort(data.officename),
      stateCode: 'mn'
    },

    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: 'Minnesota',
      subArea: `District ${district}`,
      seatName: seat,
      boundary_id: `usa-mn-judicial-27-${district.padStart(2, '0')}`,
      body_id: bodyId
    },

    contest: {
      id: contestId,
      name: contestId,
      title,
      shortTitle,
      sort: makeSort(title),
      description: data.description,
      localId: `${district.padStart(2, '0')}-${seat.padStart(2, '0')}`,
      apId: data.raceid,
      type: parseContestType(data.racetypeid),
      special: false,
      elect: undefined,
      uncontested: data.uncontested,
      partisan: isParty(data.party),
      question: data.is_ballot_measure,
      voteType: undefined,
      reporting: null,
      totalPrecincts: data.precinctstotal,
      subContest: false,
      election_id: options.election.get('id')
    }
  };
}

// US House
function parseUSHouse(data, options = {}) {
  let bodyId = 'usa-congress-house';
  let officeId = `${bodyId}-mn-${data.seatnum.padStart(2, '0')}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}`;
  let title = `Minnesota Congressional District ${data.seatnum}`;
  let shortTitle = `District ${data.seatnum}`;

  return {
    body: {
      id: bodyId,
      name: bodyId,
      title: 'United States House of Representatives',
      shortTitle: 'U.S. House',
      sort: makeSort(data.officename)
    },

    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: 'Minnesota',
      subArea: `District ${data.seatnum}`,
      seatName: undefined,
      boundary_id: `usa-congressional-district-27${data.seatnum.padStart(
        2,
        '0'
      )}`,
      body_id: bodyId
    },

    contest: {
      id: contestId,
      name: contestId,
      title,
      shortTitle,
      sort: makeSort(title),
      description: data.description,
      localId: data.seatnum.padStart(2, '0'),
      apId: data.raceid,
      type: parseContestType(data.racetypeid),
      special: false,
      elect: undefined,
      uncontested: data.uncontested,
      partisan: isParty(data.party),
      question: data.is_ballot_measure,
      voteType: undefined,
      reporting: null,
      totalPrecincts: data.precinctstotal,
      subContest: false,
      election_id: options.election.get('id')
    }
  };
}

// Parse contest type
function parseContestType(input) {
  return input.match(/^p$/i) ? 'primary' : 'general';
}

// Is part
function isParty(input) {
  return input.match(/^(np)$/i) ? false : true;
}

module.exports = parseRouter;
