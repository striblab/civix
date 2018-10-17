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
    return parseUSHouse(data, options);
  }
  else if (data.officename.match(/u.s..*senate/i)) {
    return parseUSSenate(data, options);
  }
  else if (data.officename.match(/state.*senate/i)) {
    return parseStateSenate(data, options);
  }
  else if (data.officename.match(/state.*house/i)) {
    return parseStateHouse(data, options);
  }
  else {
    throw new Error(`Unable to match: ${data.officename}`);
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
      sort: makeSort(`Minnesota ${data.officename}`),
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
      sort: makeSort(`Minnesota ${data.officename}`),
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
      sort: makeSort('United States House of Representatives')
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

// US Senate
function parseUSSenate(data, options = {}) {
  let bodyId = 'usa-congress-senate';
  let officeId = `${bodyId}-mn-${makeId(data.description)}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}`;
  let title = `Minnesota Senate ${data.description}`;
  let shortTitle = data.description;

  // Determine if special election
  // https://en.wikipedia.org/wiki/Classes_of_United_States_Senators
  let electionYear = moment(options.election.date).year();
  let special = false;
  if (
    data.description.match(/class\s+i$/i) &&
    Math.abs(electionYear - 2018) % 6 !== 0
  ) {
    special = true;
  }
  else if (
    data.description.match(/class\s+ii$/i) &&
    Math.abs(electionYear - 2020) % 6 !== 0
  ) {
    special = true;
  }
  else if (
    data.description.match(/class\s+iii$/i) &&
    Math.abs(electionYear - 2022) % 6 !== 0
  ) {
    special = true;
  }

  return {
    body: {
      id: bodyId,
      name: bodyId,
      title: 'United States Senate',
      shortTitle: 'U.S. Senate',
      sort: makeSort('United States Senate')
    },

    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: 'Minnesota',
      subArea: undefined,
      seatName: data.description,
      boundary_id: 'usa-state-mn',
      body_id: bodyId
    },

    contest: {
      id: contestId,
      name: contestId,
      title,
      shortTitle,
      sort: makeSort(title),
      description: undefined,
      localId: makeId(data.description),
      apId: data.raceid,
      type: parseContestType(data.racetypeid),
      special: special,
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

// State Senate
function parseStateSenate(data, options = {}) {
  let bodyId = 'usa-mn-state-upper';
  let officeId = `${bodyId}-27${data.seatnum.padStart(2, '0')}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}`;
  let title = `Minnesota State Senate District ${data.seatnum}`;
  let shortTitle = `District ${data.seatnum}`;

  return {
    body: {
      id: bodyId,
      name: bodyId,
      title: 'Minnesota State Senate',
      shortTitle: 'MN Senate',
      sort: makeSort('Minnesota State Senate')
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
      boundary_id: `usa-mn-state-upper-27${data.seatnum.padStart(2, '0')}`,
      body_id: bodyId
    },

    contest: {
      id: contestId,
      name: contestId,
      title,
      shortTitle,
      sort: makeSort(title),
      description: undefined,
      localId: makeId(data.description),
      apId: data.raceid,
      type: parseContestType(data.racetypeid),
      special: undefined,
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

// State House
function parseStateHouse(data, options = {}) {
  // Get district from seat name
  let district = data.seatname.match(/district\s+([0-9]+[a-z]+)/i)[1];

  let bodyId = 'usa-mn-state-lower';
  let officeId = `${bodyId}-27${district.toLowerCase().padStart(3, '0')}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}`;
  let title = `Minnesota State House District ${district}`;
  let shortTitle = `District ${district}`;

  return {
    body: {
      id: bodyId,
      name: bodyId,
      title: 'Minnesota State House of Representatives',
      shortTitle: 'MN House',
      sort: makeSort('Minnesota State House of Representatives')
    },

    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: 'Minnesota',
      subArea: `District ${district}`,
      seatName: undefined,
      boundary_id: `usa-mn-state-lower-27${district
        .toLowerCase()
        .padStart(3, '0')}`,
      body_id: bodyId
    },

    contest: {
      id: contestId,
      name: contestId,
      title,
      shortTitle,
      sort: makeSort(title),
      description: undefined,
      localId: makeId(data.description),
      apId: data.raceid,
      type: parseContestType(data.racetypeid),
      special: undefined,
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
