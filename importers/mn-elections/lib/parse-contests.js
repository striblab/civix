/**
 * Parse contests from a li
 */

// Dependencies
const _ = require('lodash');
const moment = require('moment-timezone');
const { makeId, makeSort } = require('../../../lib/strings.js');

// Main parser
function parser(contestData = {}, options = {}) {
  let validTypes = [
    'state',
    'local',
    'school',
    'hospital',
    'county',
    'county-commissioner',
    'soil-water',
    'state-lower',
    'state-upper',
    'us-house',
    'us-senate',
    'judicial',
    'judicial-district'
  ];

  if (!~validTypes.indexOf(options.type)) {
    throw new Error(`Unable to recognize type: ${options.type}`);
  }

  if (!parsers[options.type]) {
    throw new Error(`Unable to find parser for: ${options.type}`);
  }

  return parsers[options.type](contestData, options);
}

// Parsers
const parsers = {
  // State level results
  state: (data, options) => {
    let contest = commonParser(data);

    // Governor name change
    contest.contestName = contest.contestName.match(/governor/i)
      ? 'Governor'
      : contest.contestName;

    let officeId = `usa-mn-${makeId(contest.contestName)}`;
    let contestId = `${moment(options.election.get('date')).format(
      'YYYYMMDD'
    )}-${officeId}`;
    let title = `Minnesota ${contest.contestName}`;
    let shortTitle = contest.contestName;

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
        localId: contest.id,
        // TODO
        //type: ,
        special: contest.special,
        elect: contest.seats,
        uncontested: contest.uncontested,
        partisan: !contest.nonPartisan,
        question: contest.question,
        // questionTitle: ,
        // questionText: ,
        voteType: undefined,
        reporting: undefined,
        totalPrecincts: contest.totalPrecincts,
        subContest: false,
        election_id: options.election.get('id'),
        office_id: officeId
      }
    };
  },

  // US Senate
  'us-senate': (data, options) => {
    let contest = commonParser(data);
    let bodyId = 'usa-congress-senate';

    // Determine if special election
    // https://en.wikipedia.org/wiki/Classes_of_United_States_Senators
    let electionYear = moment(options.election.get('date')).year();
    // Class I or Class II
    let className = 'Class I';
    if (contest.special && Math.abs(electionYear - 2018) % 6 !== 0) {
      className = 'Class II';
    }

    let officeId = `${bodyId}-mn-${makeId(className)}`;
    let contestId = `${moment(options.election.get('date')).format(
      'YYYYMMDD'
    )}-${officeId}`;
    let title = `Minnesota Senate ${className}`;
    let shortTitle = className;

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
        seatName: className,
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
        localId: contest.id,
        // TODO
        //type: ,
        special: contest.special,
        elect: contest.elect,
        uncontested: contest.uncontested,
        partisan: !contest.nonPartisan,
        question: contest.question,
        // questionTitle: ,
        // questionText: ,
        voteType: undefined,
        reporting: undefined,
        totalPrecincts: contest.totalPrecincts,
        subContest: false,
        election_id: options.election.get('id'),
        office_id: officeId
      }
    };
  },

  // US House
  'us-house': (data, options) => {
    let contest = commonParser(data);
    let bodyId = 'usa-congress-house';
    let officeId = `${bodyId}-mn-${contest.district.padStart(2, '0')}`;
    let contestId = `${moment(options.election.get('date')).format(
      'YYYYMMDD'
    )}-${officeId}`;
    let title = `Minnesota Congressional District ${contest.district}`;
    let shortTitle = `District ${contest.district}`;

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
        subArea: `District ${contest.district}`,
        seatName: undefined,
        boundary_id: `usa-congressional-district-27${contest.district.padStart(
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
        description: undefined,
        localId: contest.id,
        // TODO
        //type: ,
        special: contest.special,
        elect: contest.elect,
        uncontested: contest.uncontested,
        partisan: !contest.nonPartisan,
        question: contest.question,
        // questionTitle: ,
        // questionText: ,
        voteType: undefined,
        reporting: undefined,
        totalPrecincts: contest.totalPrecincts,
        subContest: false,
        election_id: options.election.get('id'),
        office_id: officeId
      }
    };
  },

  // State level judicial
  judicial: (data, options) => {
    let contest = commonParser(data);
    let officeName = contest.contestName.match(/supreme/i)
      ? 'Supreme Court'
      : 'Appeals Court';
    let seat = contest.contestName.match(/chief\s+justice/i)
      ? 'Chief Justice'
      : contest.contestName.match(/([0-9]+)$/)[1];
    let bodyId = `usa-mn-${makeId(officeName)}`;
    let officeId = `${bodyId}-${makeId(seat.padStart(2, '0'))}`;
    let contestId = `${moment(options.election.get('date')).format(
      'YYYYMMDD'
    )}-${officeId}`;
    let title = `Minnesota ${officeName} ${
      seat.match(/chief/i) ? seat : 'Seat ' + seat
    }`;
    let shortTitle = `${seat.match(/chief/i) ? seat : 'Seat ' + seat}`;

    return {
      body: {
        id: bodyId,
        name: bodyId,
        title: `Minnesota ${officeName}`,
        shortTitle: officeName,
        sort: makeSort(`Minnesota ${officeName}`),
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
        seatName: seat.match(/chief/i) ? seat : 'Seat ' + seat,
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
        localId: contest.id,
        // TODO
        //type: ,
        special: contest.special,
        elect: contest.elect,
        uncontested: contest.uncontested,
        partisan: !contest.nonPartisan,
        question: contest.question,
        // questionTitle: ,
        // questionText: ,
        voteType: undefined,
        reporting: undefined,
        totalPrecincts: contest.totalPrecincts,
        subContest: false,
        election_id: options.election.get('id'),
        office_id: officeId
      }
    };
  },

  // Judicial districts
  'judicial-district': (data, options) => {
    let contest = commonParser(data);

    // Get seat
    let p = contest.contestName.match(/judge.*district\s+court.*([0-9]+)/i);
    let seat = p[1];

    let bodyId = 'usa-mn-district-court';
    let officeId = `${bodyId}-${contest.district.padStart(
      2,
      '0'
    )}-${seat.padStart(2, '0')}`;
    let contestId = `${moment(options.election.get('date')).format(
      'YYYYMMDD'
    )}-${officeId}`;
    let title = `Minnesota District Court ${contest.district} Seat ${seat}`;
    let shortTitle = `District ${contest.district} Seat ${seat}`;

    return {
      body: {
        id: bodyId,
        name: bodyId,
        title: 'Minnesota District Court',
        shortTitle: 'District Court',
        sort: makeSort('Minnesota District Court'),
        stateCode: 'mn'
      },

      office: {
        id: officeId,
        name: officeId,
        title,
        shortTitle,
        sort: makeSort(title),
        area: 'Minnesota',
        subArea: `District ${contest.district}`,
        seatName: seat,
        boundary_id: `usa-mn-judicial-27-${contest.district.padStart(2, '0')}`,
        body_id: bodyId
      },

      contest: {
        id: contestId,
        name: contestId,
        title,
        shortTitle,
        sort: makeSort(title),
        description: undefined,
        localId: contest.id,
        // TODO
        //type: ,
        special: contest.special,
        elect: contest.elect,
        uncontested: contest.uncontested,
        partisan: !contest.nonPartisan,
        question: contest.question,
        // questionTitle: ,
        // questionText: ,
        voteType: undefined,
        reporting: undefined,
        totalPrecincts: contest.totalPrecincts,
        subContest: false,
        election_id: options.election.get('id'),
        office_id: officeId
      }
    };
  },

  // State house
  'state-lower': (data, options) => {
    let contest = commonParser(data);
    let district = contest.district.replace(/^0+/, '');

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
        localId: contest.id,
        // TODO
        //type: ,
        special: contest.special,
        elect: contest.elect,
        uncontested: contest.uncontested,
        partisan: !contest.nonPartisan,
        question: contest.question,
        // questionTitle: ,
        // questionText: ,
        voteType: undefined,
        reporting: undefined,
        totalPrecincts: contest.totalPrecincts,
        subContest: false,
        election_id: options.election.get('id'),
        office_id: officeId
      }
    };
  },

  // State senate
  'state-upper': (data, options) => {
    let contest = commonParser(data);
    let district = contest.district.replace(/^0+/, '');

    let bodyId = 'usa-mn-state-upper';
    let officeId = `${bodyId}-27${district.toLowerCase().padStart(2, '0')}`;
    let contestId = `${moment(options.election.get('date')).format(
      'YYYYMMDD'
    )}-${officeId}`;
    let title = `Minnesota State Senate District ${district}`;
    let shortTitle = `District ${district}`;

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
        subArea: `District ${district}`,
        seatName: undefined,
        boundary_id: `usa-mn-state-upper-27${district
          .toLowerCase()
          .padStart(2, '0')}`,
        body_id: bodyId
      },

      contest: {
        id: contestId,
        name: contestId,
        title,
        shortTitle,
        sort: makeSort(title),
        description: undefined,
        localId: contest.id,
        // TODO
        //type: ,
        special: contest.special,
        elect: contest.elect,
        uncontested: contest.uncontested,
        partisan: !contest.nonPartisan,
        question: contest.question,
        // questionTitle: ,
        // questionText: ,
        voteType: undefined,
        reporting: undefined,
        totalPrecincts: contest.totalPrecincts,
        subContest: false,
        election_id: options.election.get('id'),
        office_id: officeId
      }
    };
  },

  // Local races
  local: (data, options) => {
    let contest = commonParser(data);

    // For some reason there are hosptical districts in here
    if (contest.contestName.match(/hospital\s+district/i)) {
      return;
    }

    // Parse out more form contest name.  First remove elect part
    let contestName = contest.contestName
      .replace(/\(elect\s+[0-9]+\)/i, '')
      .trim();

    // Look for area
    let areaMatch = contestName.match(/\((.+)\)/);
    let area = areaMatch ? areaMatch[1] : undefined;
    contestName = contestName.replace(areaMatch ? areaMatch[0] : '', '');

    // Seat
    let seatMatch = contestName.match(/seat\s+([0-9a-z]+)/i);
    let seat = seatMatch ? seatMatch[1] : undefined;
    contestName = contestName.replace(seatMatch ? seatMatch[0] : '', '');

    // Wards or similar
    let wardMatch = contestName.match(
      /(ward|district)\s+([0-9a-z]{1,3})(\s|$)/i
    );
    let ward = wardMatch ? wardMatch[2] : undefined;
    contestName = contestName.replace(wardMatch ? wardMatch[0] : '', '');

    // At large is a nicety
    let atLargeMatch = contestName.match(/at\s+large/i);
    let atLarge = atLargeMatch ? true : false;
    contestName = contestName.replace(atLargeMatch ? atLargeMatch[0] : '', '');

    // Format
    contestName = contestName.replace(/\s+/, ' ').trim();
    contestName = contestName.match(/[A-Z]{4}/)
      ? _.startCase(contestName.toLowerCase())
      : contestName;

    // MCD id
    let mcdId = contest.district.padStart(5, '0');

    // Body if there's a ward
    let records = {};
    if (ward) {
      records.body = {
        id: `usa-mn-local-27${mcdId}-${makeId(contestName)}`,
        name: `usa-mn-local-27${mcdId}-${makeId(contestName)}`,
        title: `${area} City Council`,
        shortTitle: 'City Council',
        sort: makeSort(area)
      };
    }

    // Parts
    let wardId =
      ward && ward.match(/[0-9]/)
        ? ward.padStart(2, '0')
        : ward
          ? makeId(ward)
          : '';
    let seatId =
      seat && seat.match(/[0-9]/)
        ? seat.padStart(2, '0')
        : seat
          ? makeId(seat)
          : '';
    let officeId = `usa-mn-local-27${mcdId}${ward ? '-' + wardId : ''}-${makeId(
      contestName
    )}${seat ? '-' + seatId : ''}`;
    let contestId = `${moment(options.election.get('date')).format(
      'YYYYMMDD'
    )}-${officeId}-${contest.contest}`;
    let title = `${area} ${contestName}${atLarge ? ' at Large' : ''} ${
      seat ? 'Seat ' + seat : ''
    }`.trim();
    let shortTitle = `${contestName}${atLarge ? ' at Large' : ''} ${
      seat ? 'Seat ' + seat : ''
    }`.trim();

    // Questions do not have an office
    if (!contest.question) {
      records.office = {
        id: officeId,
        name: officeId,
        title,
        shortTitle,
        sort: makeSort(title),
        area: area,
        subArea: ward ? `Ward ${ward}` : atLarge ? 'at Large' : undefined,
        seatName: seat,
        boundary_id: ward
          ? `usa-mn-local-ward-27${mcdId}-${wardId}`
          : `usa-mn-local-27${mcdId}`,
        body_id: records.body ? records.body.id : undefined
      };
    }

    records.contest = {
      id: contestId,
      name: contestId,
      title,
      shortTitle,
      sort: makeSort(title),
      description: undefined,
      localId: contest.id,
      // TODO
      //type: ,
      special: contest.special,
      elect: contest.elect,
      uncontested: contest.uncontested,
      partisan: !contest.nonPartisan,
      question: contest.question,
      // questionTitle: ,
      // questionText: ,
      voteType: undefined,
      reporting: undefined,
      totalPrecincts: contest.totalPrecincts,
      subContest: false,
      election_id: options.election.get('id'),
      office_id: records.office ? records.office.id : undefined
    };

    return records;
  }
};

// Common parse parts
function commonParser(contestData) {
  let example = contestData[0];
  let seatMatch = example.contestName.match(/elect\s+([0-9]+)/i);
  let specialMatch = example.contestName.match(/special/i);
  let rankedChoiceMatch = example.contestName.match(/choice/i);
  let questionMatch = example.contestName.match(/question/i);
  let partisan = _.find(contestData, d => !d.party.match(/^(np|wi)$/i));
  let hasWriteIn = _.find(contestData, d => d.party.match(/^wi$/i));

  example.seats = seatMatch ? parseInt(seatMatch[1], 10) : 1;
  example.special = specialMatch ? true : false;
  example.rankedChoice = rankedChoiceMatch ? true : false;
  example.nonPartisan = !partisan;
  example.hasWriteIn = !!hasWriteIn;
  example.question = !!questionMatch;
  example.uncontested =
    contestData.length === example.seats + (hasWriteIn ? 1 : 0);

  // Remove parts about special
  example.contestNameOriginal = example.contestName;
  if (example.special) {
    example.contestName = example.contestName.replace(/special.*?for/i, '');
  }

  return example;
}

// Exports
module.exports = parser;
