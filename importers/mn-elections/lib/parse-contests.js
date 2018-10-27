/**
 * Parse contests from a li
 */

// Dependencies
const _ = require('lodash');
const moment = require('moment-timezone');
const { makeId, makeSort } = require('../../../lib/strings.js');
const debug = require('debug')('civix:importer:mn-elections:parse-contests');

// Main parser
async function contestParser(contestData = {}, options = {}) {
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

  return await parsers[options.type](contestData, options);
}

// Parsers
const parsers = {};

// State level results
parsers.state = (data, options) => {
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
};

// US Senate
parsers['us-senate'] = (data, options) => {
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
};

// US House
parsers['us-house'] = (data, options) => {
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
};

// State level judicial
parsers.judicial = (data, options) => {
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
};

// Judicial districts
parsers['judicial-district'] = (data, options) => {
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
};

// State house
parsers['state-lower'] = (data, options) => {
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
};

// State senate
parsers['state-upper'] = (data, options) => {
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
};

// Local races
parsers.local = (data, options) => {
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
  let wardMatch = contestName.match(/(ward|district)\s+([0-9a-z]{1,3})(\s|$)/i);
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
      sort: makeSort(`${area} City Council`)
    };
  }

  // Attemp to get question
  let question;
  if (options.meta && options.meta.questions && contest.question) {
    question = _.find(options.meta.questions.data, {
      contestName: contest.contestName,
      contest: contest.contest
    });
  }

  // Try to get counties from meta
  let metaCounties;
  if (options.meta && options.meta['district-local']) {
    metaCounties = _.filter(options.meta['district-local'].data, d => {
      return d.mcd === contest.district;
    });
  }
  records.metaSource = {
    counties: metaCounties,
    countyIds: _.map(metaCounties, 'countyFips')
  };

  // Discrepency.  Hiblings uses letter for wards, but SoS results use
  // numbers
  // http://www.hibbing.mn.us/city-administration/elected-officials
  if (options.election.get('id') === 'usa-mn-20181106') {
    if (contest.district === '28790' && ward) {
      ward = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' }[ward];
    }
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
  let title = `${area} ${contestName}${
    ward ? ' Ward ' + ward : atLarge ? ' at Large' : ''
  } ${seat ? 'Seat ' + seat : ''}`.trim();
  let shortTitle = `${contestName}${
    ward ? ' Ward ' + ward : atLarge ? ' at Large' : ''
  } ${seat ? 'Seat ' + seat : ''}`.trim();

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
        : `usa-mn-county-local-27${mcdId}`,
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
    questionTitle: question ? question.questionTitle : undefined,
    questionText: question ? question.questionText : undefined,
    voteType: undefined,
    reporting: undefined,
    totalPrecincts: contest.totalPrecincts,
    subContest: false,
    election_id: options.election.get('id'),
    office_id: records.office ? records.office.id : undefined
  };

  return records;
};

// School districts
parsers.school = async (data, options) => {
  let contest = commonParser(data);

  // Parse out parts, first elect
  let contestName = contest.contestName
    .replace(/\(elect\s+[0-9]+\)/i, '')
    .trim();

  // South Sait Paul says its an ISD, when its really a SSD
  // http://w20.education.state.mn.us/MdeOrgView/search/tagged/MDEORG_LEA
  if (options.election.get('id') === 'usa-mn-20181106') {
    if (contestName.match(/isd.*?[0-9]+/i) && contest.district === '0006') {
      contestName = contestName.replace(/isd.*?([0-9]+)/i, 'SSD $1');
    }
  }

  // ISD or SSD
  let districtTypeMatch = contestName.match(/\((ssd|isd).*?([0-9]+)\)/i);
  let districtType = districtTypeMatch
    ? districtTypeMatch[1].toLowerCase()
    : undefined;
  //let districtTypeId = districtTypeMatch ? districtTypeMatch[2] : undefined;
  contestName = contestName.replace(
    districtTypeMatch ? districtTypeMatch[0] : '',
    ''
  );
  let districtId = `${
    districtType === 'ssd' ? '03' : '01'
  }-${contest.district.padStart(4, '0')}`;

  // Wards or similar
  let wardMatch = contestName.match(/(ward|district)\s+([0-9a-z]{1,3})(\s|$)/i);
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

  // Attemp to get question
  let question;
  if (options.meta && options.meta.questions && contest.question) {
    question = _.find(options.meta.questions.data, {
      contestName: contest.contestName,
      contest: contest.contest
    });
  }

  // Get area from DB
  let areaRecord = await options.db.findOneCached(options.models.Boundary, {
    where: { id: `usa-mn-school-${districtId}` }
  });
  let area = areaRecord ? areaRecord.get('title') : undefined;
  if (!area) {
    debug(`Unable to find school area for: usa-mn-school-${districtId}`);
  }

  // Parts
  let wardId =
    ward && ward.match(/[0-9]/)
      ? ward.padStart(2, '0')
      : ward
        ? makeId(ward)
        : '';
  let officeId = `usa-mn-school-${districtId}${
    ward ? '-' + wardId : ''
  }-${makeId(contestName)}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}-${contest.contest}`;
  let title = `${area ? area : ''} ${contestName}${
    ward ? ' District ' + ward : atLarge ? ' at Large' : ''
  }`.trim();
  let shortTitle = `${contestName}${
    ward ? ' District ' + ward : atLarge ? ' at Large' : ''
  }`;

  // Records
  let records = {};

  // Try to get counties from meta
  let metaCounties;
  if (options.meta && options.meta['district-school']) {
    metaCounties = _.filter(options.meta['district-school'].data, d => {
      return (
        d.schoolType === (districtType === 'ssd' ? '03' : '01') &&
        d.school === contest.district.padStart(4, '0')
      );
    });

    records.metaSource = {
      counties: metaCounties,
      countyIds: _.map(metaCounties, 'countyFips')
    };
  }

  // Body if there's a ward
  if (ward) {
    records.body = {
      id: `usa-mn-school-${districtId}`,
      name: `usa-mn-school-${districtId}`,
      title: `${area ? area : ''} School District`.trim(),
      shortTitle: 'School District',
      sort: makeSort(`${area ? area : ''} School District`.trim())
    };
  }

  // Questions do not have an office
  if (!contest.question) {
    records.office = {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: area,
      subArea: ward ? `Sub-District ${ward}` : atLarge ? 'at Large' : undefined,
      // Don't have boundaries for sub-districts
      boundary_id: ward ? undefined : `usa-mn-school-${districtId}`,
      body_id: records.body ? records.body.id : undefined
    };
  }

  // Contest
  records.contest = {
    id: contestId,
    name: contestId,
    title,
    shortTitle,
    sort: makeSort(title),
    localId: contest.id,
    // TODO
    //type: ,
    special: contest.special,
    elect: contest.elect,
    uncontested: contest.uncontested,
    partisan: !contest.nonPartisan,
    question: contest.question,
    questionTitle: question ? question.questionTitle : undefined,
    questionText: question ? question.questionText : undefined,
    voteType: undefined,
    reporting: undefined,
    totalPrecincts: contest.totalPrecincts,
    subContest: false,
    election_id: options.election.get('id'),
    office_id: !contest.question ? officeId : undefined
  };

  return records;
};

// State, specifically three rivers park districts
// County Park Commissioner District 2
parsers['park-district'] = async (data, options) => {
  let contest = commonParser(data);

  // Get district number
  let district = contest.contestName.match(/district\s+([0-9]+)/i)[1];

  // Ids
  let bodyId = 'usa-mn-park-district';
  let officeId = `${bodyId}-27${district.padStart(2, '0')}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}-${contest.contest}`;
  let title = `Three Rivers Park District ${district}`;
  let shortTitle = `District ${district}`;

  return {
    body: {
      id: bodyId,
      name: bodyId,
      title: 'Three Rivers Park Districts',
      shortTitle: 'Park Districts',
      sort: makeSort('Three Rivers Park Districts')
    },

    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: `District ${district}`,
      subArea: undefined,
      seatName: undefined,
      boundary_id: `usa-mn-park-district-27${district
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
};

// County Comissioner (sub-districts of counties)
parsers['county-commissioner'] = async (data, options) => {
  let contest = commonParser(data);

  // Get district number
  let district = contest.contestName.match(/district\s+([0-9]+)/i)[1];

  // Get county FIPs
  let countyFips = mnCountyToFips(contest.county);

  // Get county name
  let areaRecord = await options.db.findOneCached(options.models.Boundary, {
    where: { id: `usa-county-27${countyFips.padStart(3, '0')}` }
  });
  let area = areaRecord ? areaRecord.get('shortTitle') : undefined;
  if (!area) {
    debug(
      `Unable to find area for: usa-county-27${countyFips.padStart(3, '0')}`
    );
  }

  // Ids
  let bodyId = `usa-mn-county-commissioner-27${countyFips.padStart(3, '0')}`;
  let officeId = `${bodyId}-${district.padStart(2, '0')}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}-${contest.contest}`;
  let title = `${area} County Commissioner District ${district}`;
  let shortTitle = `District ${district}`;

  return {
    body: {
      id: bodyId,
      name: bodyId,
      title: `${area} County Commissioners`,
      shortTitle: 'County Commissioners',
      sort: makeSort(`${area} County Commissioners`)
    },

    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: area,
      subArea: `District ${district}`,
      seatName: undefined,
      boundary_id: `usa-mn-county-commissioner-27${countyFips}-${district
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
};

// Soil and Water Conservation Districts (has up to 5 Supervisor seats)
// and (some districts have subdistricts)
parsers['soil-water'] = async (data, options) => {
  let contest = commonParser(data);

  // Get seat number
  let seat = contest.contestName.match(/district\s+([0-9]+)/i)[1];

  // For some reasont the id numbers for Anoka county sub districts are
  // off
  if (options.election.get('id') === 'usa-mn-20181106') {
    contest.district = contest.district === '4002' ? '4004' : contest.district;
    contest.district = contest.district === '4003' ? '4005' : contest.district;
  }

  // Get district name.  There's no good way to know if this
  // contest is a sub district race or just a seat.  Yay!
  let subdistrictRecord = await options.db.findOneCached(
    options.models.Boundary,
    {
      where: {
        id: `usa-mn-soil-water-subdistrict-27-${contest.district.padStart(
          4,
          '0'
        )}`
      }
    }
  );
  let soilRecord = await options.db.findOneCached(options.models.Boundary, {
    where: { id: `usa-mn-soil-water-27-${contest.district.padStart(4, '0')}` }
  });
  let subdistrict = !!subdistrictRecord;
  let area = subdistrictRecord
    ? subdistrictRecord.get('shortTitle')
    : soilRecord
      ? soilRecord.get('shortTitle')
      : undefined;
  if (!area) {
    debug(
      `Unable to find area for: usa-mn-soil-water-subdistrict-27-${contest.district.padStart(
        4,
        '0'
      )} or usa-mn-soil-water-27-${contest.district.padStart(4, '0')}`
    );
  }

  // Ids
  let bodyId = `usa-mn-soil-water-${
    subdistrict ? 'subdistrict-' : ''
  }27-${contest.district.padStart(4, '0')}`;
  let officeId = `${bodyId}-${seat.padStart(2, '0')}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}-${contest.contest}`;
  let title = `${area} Soil and Water Conservation District ${
    subdistrict ? 'Subdistrict ' + seat : 'Seat ' + seat
  }`;
  let shortTitle = `${area} Seat ${seat}`;

  return {
    body: {
      id: bodyId,
      name: bodyId,
      title: `${area} Soil and Water Conservation District`,
      shortTitle: area,
      sort: makeSort(`${area} Soil and Water Conservation District`)
    },

    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: area,
      subArea: undefined,
      seatName: seat,
      boundary_id: `usa-mn-soil-water-${
        subdistrict ? 'subdistrict-' : ''
      }27-${contest.district.padStart(4, '0')}`,
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
};

// County
parsers.county = async (data, options) => {
  let contest = commonParser(data);

  // County results, actually include Soil and Water and County Commissioner
  if (contest.contestName.match(/soil.*water.*supervisor/i)) {
    return await parsers['soil-water'](data, options);
  }
  else if (contest.contestName.match(/county.*park/i)) {
    return await parsers['park-district'](data, options);
  }
  else if (contest.contestName.match(/county.*commissioner/i)) {
    return await parsers['county-commissioner'](data, options);
  }

  // Get county FIPs
  let countyFips = mnCountyToFips(contest.county);

  // Get county name
  let areaRecord = await options.db.findOneCached(options.models.Boundary, {
    where: { id: `usa-county-27${countyFips.padStart(3, '0')}` }
  });
  let area = areaRecord ? areaRecord.get('shortTitle') : undefined;
  if (!area) {
    debug(
      `Unable to find area for: usa-county-27${countyFips.padStart(3, '0')}`
    );
  }

  // Short contest name
  let shortContestName = contest.contestName.replace(/county/i, '').trim();

  // Ids
  let officeId = `usa-county-27${countyFips.padStart(3, '0')}-${makeId(
    shortContestName
  )}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}-${contest.contest}`;
  let title = `${area} ${contest.contestName}`;
  let shortTitle = `${contest.contestName}`;

  return {
    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: area,
      subArea: undefined,
      seatName: undefined,
      boundary_id: `usa-county-27${countyFips.padStart(3, '0')}`
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
};

// Larger, state-level hopstical districts

parsers['hospital-district'] = async (data, options) => {
  let contest = commonParser(data);

  // Get area
  let areaRecord = await options.db.findOneCached(options.models.Boundary, {
    where: {
      id: `usa-mn-hospital-district-27-${contest.district.padStart(4, '0')}`
    }
  });
  let area = areaRecord ? areaRecord.get('shortTitle') : undefined;
  if (!area) {
    debug(
      `Unable to find boundary for: usa-mn-hospital-district-27-${contest.district.padStart(
        4,
        '0'
      )}`
    );
  }

  //
  let officeId = `usa-mn-hospital-district-27-${contest.district.padStart(
    4,
    '0'
  )}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}-${contest.contest}`;
  let title = `${area} Hospital District Board Member`;
  let shortTitle = area;

  return {
    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: area,
      boundary_id: `usa-mn-hospital-district-27-${contest.district.padStart(
        4,
        '0'
      )}`
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
};

// Hopsital districts.  There are large hospital districts, and then
// there are ones that corresponde to local/mcd/towns
parsers.hospital = async (data, options) => {
  let contest = commonParser(data);

  // The most consistent way to know if this is a larger hopsital district
  if (contest.district.match(/^[0-9]{1,4}$/)) {
    return await parsers['hospital-district'](data, options);
  }

  // Pull out area
  //let contestName = contest.contestName;
  let areaMatch = contest.contestName.match(/\((.*?)\)/i);
  let area = areaMatch ? areaMatch[1] : undefined;
  //contestName = area ? contestName.replace(areaMatch[0], '').trim() : contestName;

  let officeId = `usa-mn-local-hospital-27-${contest.district.padStart(
    5,
    '0'
  )}`;
  let contestId = `${moment(options.election.get('date')).format(
    'YYYYMMDD'
  )}-${officeId}-${contest.contest}`;
  let title = `${area} Hospital District Board Member`;
  let shortTitle = area;

  return {
    office: {
      id: officeId,
      name: officeId,
      title,
      shortTitle,
      sort: makeSort(title),
      area: area,
      boundary_id: `usa-mn-county-local-27${contest.district.padStart(5, '0')}`
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
};

// Common parse parts
function commonParser(contestData) {
  let example = contestData[0];
  let electMatch = example.contestName.match(/elect\s+([0-9]+)/i);
  let specialMatch = example.contestName.match(/special/i);
  let rankedChoiceMatch = example.contestName.match(/choice/i);
  let questionMatch = example.contestName.match(/question/i);
  let partisan = _.find(contestData, d => !d.party.match(/^(np|wi)$/i));
  let hasWriteIn = _.find(contestData, d => d.party.match(/^wi$/i));

  example.elect = electMatch ? parseInt(electMatch[1], 10) : 1;
  example.special = specialMatch ? true : false;
  example.rankedChoice = rankedChoiceMatch ? true : false;
  example.nonPartisan = !partisan;
  example.hasWriteIn = !!hasWriteIn;
  example.question = !!questionMatch;
  example.uncontested =
    contestData.length === example.elect + (hasWriteIn ? 1 : 0);

  // Remove parts about special
  example.contestNameOriginal = example.contestName;
  if (example.special) {
    example.contestName = example.contestName.replace(/special.*?for/i, '');
  }

  return example;
}

// Turn MN county code to FIPS
function mnCountyToFips(code) {
  return (parseInt(code, 10) * 2 - 1).toString().padStart(3, '0');
}

// Exports
module.exports = {
  commonParser,
  contestParser,
  mnCountyToFips
};
