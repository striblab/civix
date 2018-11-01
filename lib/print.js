/**
 * Output for print
 */

// Dependencies
const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');
const config = require('../config');
const db = require('./db.js');
const moment = require('moment');
const FTP = require('ftp');
const Sequelize = require('sequelize');
const { toOrdinal } = require('number-to-words');
const { makeSort } = require('./strings.js');
const debug = require('debug')('civix:print');

// Shortcut
const Op = Sequelize.Op;

// Metro area
// const metroCounties = [
//   '02',
//   '10',
//   '13',
//   '19',
//   '27',
//   '30',
//   '62',
//   '70',
//   '71',
//   '82',
//   '86'
// ];
//const metroCountySmall = [2, 10, 19, 27, 62, 70, 82];
const metroAreaFipsNumbers = [3, 19, 37, 53, 123, 139, 163];
const metroAreaFips = metroAreaFipsNumbers.map(n =>
  n.toString().padStart(3, '0')
);

// Line separator
const lineSeparator = '\r\n';

// Default print config
const defaultSections = [
  {
    title: 'U.S. Senate',
    filename: 'ELEX_USSEN',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.office_id &&
        contest.office_id.match(/usa-congress-senate-mn/i)
      );
    },
    headings: contest => {
      return [`U.S. Senate ${contest.special ? ' Special Election' : ''}`];
    },
    candidatePartyLabel: true
  },
  {
    title: 'U.S. House',
    filename: 'ELEX_USHSE',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.office_id &&
        contest.office_id.match(/usa-congress-house/i)
      );
    },
    headings: contest => {
      return [`${contest.office.shortTitle}`];
    },
    candidatePartyLabel: true
  },
  {
    title: 'MN Governor',
    filename: 'ELEX_MNGOV',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.office_id &&
        contest.office_id.match(/usa-mn-governor/i)
      );
    },
    headings: () => null,
    candidatePartyLabel: true
  },
  {
    title: 'MN Executive w/o Governor',
    filename: 'ELEX_MNEXEC',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.office_id &&
        contest.office_id.match(
          /(usa-mn-attorney-general|usa-mn-secretary-state|usa-mn-auditor)/i
        )
      );
    },
    headings: contest => {
      return [`${contest.office.shortTitle}`];
    },
    candidatePartyLabel: true
  },
  {
    title: 'MN House',
    filename: 'ELEX_MNHSE',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.office_id &&
        contest.office_id.match(/usa-mn-state-lower/i)
      );
    },
    headings: contest => {
      return [`${contest.office.shortTitle}`];
    },
    candidatePartyLabel: true
  },
  {
    title: 'MN Senate',
    filename: 'ELEX_MNSEN',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.office_id &&
        contest.office_id.match(/usa-mn-state-upper/i)
      );
    },
    headings: contest => {
      // Manually, since AP doesn't mark special
      return [`Special: ${contest.office.shortTitle}`];
    },
    candidatePartyLabel: true
  },
  {
    title: 'MN State-level Judicial',
    filename: 'ELEX_MNJUD',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.office_id &&
        contest.office_id.match(/(usa-mn-appeals-court|usa-mn-supreme-court)/i)
      );
    },
    headings: contest => {
      let court = contest.office_id.match(/usa-mn-appeals-court/i)
        ? 'appeals'
        : 'supreme';
      let title2;
      if (court === 'supreme') {
        title2 = contest.title.match(/chief/i)
          ? 'Chief Justice'
          : `Associate Justice - Seat ${contest.office.seatName}`;
      }
      else {
        title2 = `Judge - Seat ${contest.office.seatName}`;
      }

      return [
        `${contest.office.body.shortTitle}`.replace(
          /^appeal.*court$/i,
          'Court of Appeals'
        ),
        title2
      ];
    }
  },
  {
    title: 'MN Judicial District Courts',
    filename: 'ELEX_MNJUDD',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.office_id &&
        contest.office_id.match(/usa-mn-district-court/i)
      );
    },
    headings: contest => {
      let districtNumber = contest.office.subArea.match(/([0-9]+)/)[1];
      let districtTitle = `${toOrdinal(
        parseInt(districtNumber, 10)
      )} District Court`;
      return [districtTitle, `Judge - Seat ${contest.office.seatName}`];
    }
  },
  {
    title: 'Metro Local Races',
    filename: 'ELEX_METCITY',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.id.match(/-usa-mn-local-/i) &&
        !contest.question &&
        contest.sourceData &&
        contest.sourceData['mn-sos-ftp'] &&
        contest.sourceData['mn-sos-ftp'].meta &&
        _.intersection(
          contest.sourceData['mn-sos-ftp'].meta.countyIds,
          metroAreaFips
        ).length
      );
    },
    headings: contest => {
      let area = !contest.office
        ? contest.title.replace(contest.shortTitle, '').trim()
        : contest.office.area;
      area = area.replace(/(^|\s)twp(\s|$)/i, '$1Township$2');

      return [
        `${area}`,
        special(
          contest,
          `${contest.office ? contest.office.shortTitle : contest.shortTitle}`
            .replace(/council member/i, 'City Council')
            .trim()
        )
      ];
    }
  },
  {
    title: 'Metro Local Questions',
    filename: 'ELEX_METQUES',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.id.match(/-usa-mn-local-/i) &&
        contest.question &&
        contest.sourceData &&
        contest.sourceData['mn-sos-ftp'] &&
        contest.sourceData['mn-sos-ftp'].meta &&
        _.intersection(
          contest.sourceData['mn-sos-ftp'].meta.countyIds,
          metroAreaFips
        ).length
      );
    },
    headings: contest => {
      // Questions, so no office
      let area = !contest.office
        ? contest.title.replace(contest.shortTitle, '').trim()
        : contest.office.area;
      area = area.replace(/(^|\s)twp(\s|$)/i, '$1Township$2');

      return [`${area}`];
    }
  },
  {
    title: 'Metro School Board',
    filename: 'ELEX_METSCHB',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.id.match(/-usa-mn-school-/i) &&
        !contest.question &&
        contest.sourceData &&
        contest.sourceData['mn-sos-ftp'] &&
        contest.sourceData['mn-sos-ftp'].meta &&
        _.intersection(
          contest.sourceData['mn-sos-ftp'].meta.countyIds,
          metroAreaFips
        ).length
      );
    },
    headings: contest => {
      return [
        `${contest.office.area}`,
        special(contest, contest.office.subArea)
      ];
    }
  },
  {
    title: 'Metro School Questions',
    filename: 'ELEX_METSCHQ',
    filter: contest => {
      return (
        !contest.subContest &&
        contest.id.match(/-usa-mn-school-/i) &&
        contest.question &&
        contest.sourceData &&
        contest.sourceData['mn-sos-ftp'] &&
        contest.sourceData['mn-sos-ftp'].meta &&
        _.intersection(
          contest.sourceData['mn-sos-ftp'].meta.countyIds,
          metroAreaFips
        ).length
      );
    },
    headings: contest => {
      // Questions, so no office
      let area = !contest.office
        ? contest.title.replace(contest.shortTitle, '').trim()
        : contest.office.area;

      return [`${area}`];
    }
  },
  {
    title: 'Metro County Races',
    filename: 'ELEX_METCTY',
    filter: contest => {
      let metroReg = `(${metroAreaFips.join('|')})`;

      return (
        !contest.subContest &&
        (contest.id.match(
          new RegExp(`usa-mn-county-commissioner-27${metroReg}`, 'i')
        ) ||
          contest.id.match(new RegExp(`usa-county-27${metroReg}`, 'i'))) &&
        !contest.question
      );
    },
    headings: contest => {
      let area = !contest.office
        ? contest.title.replace(contest.shortTitle, '').trim()
        : contest.office.area;

      return [
        area,
        special(
          contest,
          contest.office.title
            .replace(contest.office.area, '')
            .replace(/county\s/i, '')
            .trim()
        )
      ];
    }
  },
  {
    type: 'county-table',
    filename: 'ELEX_CTYGOV',
    filter: contest => {
      return (
        // Use top level contest for some meta data
        //contest.subContest &&
        contest.office_id && contest.office_id.match(/usa-mn-governor/i)
      );
    }
  },
  {
    type: 'county-table',
    filename: 'ELEX_CTYSEN',
    filter: contest => {
      return (
        // Use top level contest for some meta data
        //contest.subContest &&
        contest.office_id && contest.office_id.match(/usa-congress-senate-mn/i)
      );
    },
    // Rename top headings
    headings: contest => {
      return contest.special ? 'Special' : 'Scheduled';
    }
  }
];

// Print tags
const printTags = {
  heading1: '@Head1:',
  heading2: '@Elex_Head1:',
  heading3: '@Elex_Head2:',
  heading4: '@Elex_Head_Sub_Bold:',
  meta: '@Elex_Precinct:',
  note: '@Elex_Text_Question:',
  candidate: '@Elex_Text_2tabsPlusPct:',
  candidateNo: '@Elex_Text_2tabsPlusPct_Space:',
  ranked: '@Elex_Text_RCV_3choice:',
  ranked6: '@Elex_Text_RCV_6choice:',
  question: '@Elex_Text_Question:',
  countyTableRow: '@Elex_Pres_Cnty:',
  space: ''
};

// Main export function
async function makePrintOutput(options = {}) {
  options.now = moment();

  let outputPath = makeOutputPath(options);
  let contests = await getContests(options);
  let outputFiles = [];

  // Go through sections
  defaultSections.forEach(section => {
    let output =
      !section.type || section.type === 'results'
        ? renderResults(section, contests)
        : section.type === 'county-table'
          ? renderCountyTable(section, contests)
          : '';
    let filename = `${section.filename.toUpperCase()}_${options.now.format(
      'DDMMYY'
    )}_${options.now.format('HHmm')}.txt`;

    debug(filename);
    debug(`${output}\n\n`);

    // Save file
    let f = path.join(outputPath, filename);
    outputFiles.push(f);
    fs.writeFileSync(f, output);
  });

  // Upload
  if (options.upload) {
    await ftpPut(
      {
        host: config.ftpPrintHost,
        user: config.ftpPrintUser,
        password: config.ftpPrintPass,
        dir: config.ftpPrintPutLocation
      },
      outputFiles
    );
  }
}

// Make section
function renderResults(section, contests) {
  let filtered = _.filter(contests, section.filter);
  let output = '';
  let previousHeadings;

  // Order by headings
  filtered = _.orderBy(
    filtered,
    [
      c => (section.headings(c) ? makeSort(section.headings(c)[0]) : c.sort),
      'asc'
    ],
    [
      c =>
        section.headings(c) && section.headings(c)[1]
          ? makeSort(section.headings(c)[1])
          : '',
      'asc'
    ],
    [
      c =>
        section.headings(c) && section.headings(c)[2]
          ? makeSort(section.headings(c)[2])
          : '',
      'asc'
    ]
  );

  filtered.forEach(c => {
    // Headings
    let headings = section.headings(c, section);
    if (headings) {
      output += outputHeadings(headings, previousHeadings);
      previousHeadings = headings;
    }

    // Meta
    output += outputMeta(c, section);

    // Results
    output += outputResults(c, section);
  });

  return output;
}

// Ouput for headings.  If the heading is different, we output it
function outputHeadings(current, previous) {
  let output = '';
  let changedHeader = false;

  current.forEach((h, hi) => {
    if (
      h &&
      (changedHeader || (!previous || (previous[hi] && h !== previous[hi])))
    ) {
      changedHeader = true;
      output += `${printTags['heading' + (hi + 2)]}${h}${lineSeparator}`;
    }
  });

  return output;
}

// Make meta output
function outputMeta(contest) {
  let output = '';

  // Open seats
  if (
    (contest.type !== 'primary' && contest.elect > 1) ||
    (contest.type === 'primary' && contest.elect > 2)
  ) {
    output += `${printTags.meta}Open seats: ${contest.elect}${lineSeparator}`;
  }

  // Question
  if (contest.questionText) {
    // Get question number
    let questionNumberMatch = contest.shortTitle
      ? contest.shortTitle.match(/question\s([0-9]+)/i)
      : null;
    let questionNumber = questionNumberMatch ? questionNumberMatch[1] : null;

    output += `${printTags.question}${
      questionNumber ? 'Question ' + questionNumber + ': ' : ''
    }${contest.questionText.replace(/\s+/gm, ' ')}${lineSeparator}`;
  }

  // Reprting
  output += `${printTags.meta}${contest.reporting ||
    0} of ${contest.totalPrecincts || '-'} precincts (${Math.round(
    contest.totalPrecincts
      ? (contest.reporting / contest.totalPrecincts) * 100
      : 0
  )}%)${lineSeparator}`;

  return output;
}

// Output results
function outputResults(contest, section) {
  let output = '';

  // Check for ranked choice
  if (contest.voteType === 'ranked-choice') {
    return outputRankedChoiceResults(contest);
  }

  // Display party
  let dP = section.candidatePartyLabel && !contest.nonpartisan;

  // For question, should be yes first no matter winner
  if (contest.question) {
    contest.results = _.orderBy(
      contest.results,
      [
        r => {
          return r.candidate.sort;
        }
      ],
      ['desc']
    );
  }

  // TODO: Handle ranked choice
  contest.results.forEach(r => {
    // Don't display write in
    if (r.candidate.party_id === 'wi') {
      return;
    }

    // Party appreviation
    let abbr =
      r.candidate.party && r.candidate.party.abbreviation
        ? r.candidate.party.abbreviation
        : '';
    abbr = abbr.replace(/^(dem|dfl)$/i, 'D').replace(/^(rep|gop)$/i, 'R');

    output += `${printTags.candidate}${
      r.winner && r.votes ? '<saxo:ch value="226 136 154"/>' : ''
    }\t${outputName(r.candidate)}${r.incumbent ? ' (i)' : ''}${
      dP ? ' - ' + abbr : ''
    }\t${(r.votes || 0).toLocaleString()}\t${Math.round(
      (r.percent || 0) * 100
    )}%${lineSeparator}`;
  });

  return output;
}

// Ranked choice results
function outputRankedChoiceResults(contest) {
  let output = '';

  contest.results.forEach(r => {
    let rowParts = [];
    rowParts.push(
      `${printTags.ranked}${r.winner ? '<saxo:ch value="226 136 154"/>' : ''}`
    );
    rowParts.push(`${outputName(r.candidate)}${r.incumbent ? ' (i)' : ''}`);

    [1, 2, 3].forEach(rank => {
      let totals = _.find(r.resultDetails, { rankedChoice: rank });
      if (totals) {
        rowParts.push(`${(totals.votes || 0).toLocaleString()}`);
        rowParts.push(`${Math.round(totals.percent || 0)}%`);
      }
      else {
        rowParts.push('-');
        rowParts.push('-');
      }
    });

    output += `${rowParts.join('\t')}${lineSeparator}`;
  });

  return output;
}

// Output county table
function renderCountyTable(section, contests) {
  let filtered = _.filter(contests, section.filter);
  let output = '';

  // Sort by contest and county
  filtered = _.orderBy(filtered, ['sort'], ['shortTitle']);

  // Pull out the top level races
  let topContests = _.remove(filtered, f => !f.subContest);

  // Group by county
  let byCounty = _.groupBy(filtered, 'shortTitle');

  // Order candidate by top races
  let candidateOrder = [];
  _.each(topContests, top => {
    candidateOrder = candidateOrder.concat(
      _.map(
        _.filter(
          top.results,
          r => ~['rep', 'dfl', 'dem'].indexOf(r.candidate.party_id)
        ),
        r => r.candidate.id
      )
    );
  });

  // Make contest level heading if more than one race
  if (topContests.length > 1) {
    output += `${printTags.countyTableRow}\t\t${_.map(
      topContests,
      section.headings ? section.headings : 'shortTitle'
    ).join('\t')}${lineSeparator}`;
  }

  // Make heading (candidate names)
  let headingParts = ['', 'Precincts'];
  _.each(topContests, top => {
    _.each(candidateOrder, ci => {
      let r = resultByCandidate(top, ci);
      if (r) {
        // Winner mark? <saxo:ch value="226 136 154"/>
        headingParts.push(`${r.candidate.last}${r.incumbent ? ' (i)' : ''}`);
        headingParts.push('%');
      }
    });
  });
  output += `${printTags.countyTableRow}${headingParts.join(
    '\t'
  )}${lineSeparator}`;

  // Go through each county
  _.each(byCounty, countyContests => {
    let defaultC = countyContests[0];
    let rowParts = [];

    // County name
    rowParts.push(defaultC.shortTitle);

    // Precincts, for multiple contests, we assume
    // the same level of reporting.
    rowParts.push(
      Math.round(
        defaultC.totalPrecincts
          ? (defaultC.reporting / defaultC.totalPrecincts) * 100
          : 0
      )
    );

    // Results for each candidate yb contests
    _.each(countyContests, countyContest => {
      _.each(candidateOrder, ci => {
        let r = resultByCandidate(countyContest, ci);
        if (r) {
          rowParts.push((r.votes || 0).toLocaleString());
          rowParts.push(`${Math.round((r.percent || 0) * 100)}%`);
        }
      });
    });

    output += `${printTags.countyTableRow}${rowParts.join(
      '\t'
    )}${lineSeparator}`;
  });

  // Total line
  let totalLineParts = ['Totals'];
  totalLineParts.push(
    Math.round(
      topContests[0].totalPrecincts
        ? (topContests[0].reporting / topContests[0].totalPrecincts) * 100
        : 0
    )
  );
  _.each(topContests, topContest => {
    _.each(candidateOrder, ci => {
      let r = resultByCandidate(topContest, ci);
      if (r) {
        totalLineParts.push((r.votes || 0).toLocaleString());
        totalLineParts.push(`${Math.round((r.percent || 0) * 100)}%`);
      }
    });
  });
  output += `${printTags.countyTableRow}${totalLineParts.join(
    '\t'
  )}${lineSeparator}`;

  return output;
}

// Get results for candidate based on id
function resultByCandidate(contest, candidateId) {
  return _.find(contest.results, { candidate_id: candidateId });
}

// Output name
function outputName(candidate) {
  const maxNameLength = 22;
  let name = candidate.fullName;

  if (candidate.fullName > maxNameLength) {
    name = _.filter([
      candidate.first ? candidate.first[0] + '.' : '',
      candidate.middle ? candidate.middle[0] + '.' : '',
      candidate.last,
      candidate.suffix ? ', ' + candidate.suffix : ''
    ]).join(' ');
  }

  if (name.length > maxNameLength) {
    name = candidate.last;
  }

  return name;
}

// Get all the contests
async function getContests(options = {}) {
  let models = db.models;

  // Get election(s)
  let elections = await models.Election.find({
    where: { date: options.election }
  });
  if (!elections) {
    throw new Error(`Unable to find elections from: ${options.election}`);
  }
  elections = _.isArray(elections) ? elections : [elections];
  elections = _.map(elections, e => e.get('id'));

  let contests = await models.Contest.findAll({
    where: {
      election_id: { [Op.in]: elections },
      //subContest: false,
      uncontested: false
    },
    order: [
      ['sort', 'ASC'],
      ['title', 'ASC'],
      [{ model: models.Result, as: 'results' }, 'winner', 'DESC'],
      [{ model: models.Result, as: 'results' }, 'percent', 'DESC'],
      [{ model: models.Party }, 'sort', 'ASC'],
      [
        { model: models.Result, as: 'results' },
        { model: models.Candidate },
        'sort',
        'ASC'
      ]
    ],
    include: [
      {
        all: true,
        attributes: { exclude: ['sourceData'] }
      },
      {
        model: models.Result,
        attributes: { exclude: ['sourceData'] },
        include: [
          {
            model: models.Candidate,
            attributes: { exclude: ['sourceData'] },
            include: [
              {
                model: models.Party,
                attributes: { exclude: ['sourceData'] }
              }
            ]
          }
        ]
      },
      {
        model: models.Office,
        attributes: { exclude: ['sourceData'] },
        include: [
          {
            model: models.Body,
            attributes: { exclude: ['sourceData'] }
          }
        ]
      }
    ]
  });

  // Turn to json
  return _.map(contests, c => {
    let p = c.get({ plain: true });

    return p;
  });
}

// Create output directoy
function makeOutputPath(options = {}) {
  if (!options.election) {
    throw new Error('election date is needed for print output.');
  }

  let now = options.now || moment();
  let outputPath = path.join(
    config.exportPath,
    options.election,
    'print',
    now.format('YYYYMMDD-HHmmss')
  );

  try {
    fs.mkdirpSync(outputPath);
  }
  catch (e) {
    throw new Error(`Unable to create path for print export at: ${outputPath}`);
  }

  return outputPath;
}

// Main put function.  files shoudl be an array of paths to put
async function ftpPut(connectionOptions = {}, files = []) {
  // Update user/pass
  let o = _.clone(connectionOptions);
  o.host = o.host || process.env.PRINT_FTP_HOST;
  o.user = o.user || process.env.PRINT_FTP_USER;
  o.password = o.password || process.env.PRINT_FTP_PASS;
  o.dir = o.dir || process.env.PRINT_FTP_PUT_LOCATION;
  o.connTimeout = o.connTimeout || 20000;
  o.pasvTimeout = o.pasvTimeout || 20000;
  o.keepalive = o.keepalive || 5000;

  // Check connection
  if (!o.host || !o.user || !o.password || !o.dir) {
    throw new Error(
      'Make sure that the FTP configuration options are provided.'
    );
  }

  // Promisfy
  return new Promise(async (resolve, reject) => {
    // Fetch all results
    await Promise.all(
      files.map(async f => {
        try {
          debug('Putting file: ', f);
          await ftpPutfile(o, f);
        }
        catch (e) {
          debug('Unable to put file: ', f);
          reject(e);
        }
      })
    );

    resolve();
  });
}

// Put a specific file.
function ftpPutfile(options, file) {
  let fileName = path.basename(file);

  // Promisify
  return new Promise((resolve, reject) => {
    // Make connection
    let connection = new FTP();

    // Get file
    connection.on('ready', async () => {
      connection.put(file, options.dir + '/' + fileName, error => {
        if (error) {
          return reject(error);
        }

        debug('Put file: ' + file);
        connection.end();
      });
    });

    // When done
    connection.on('end', resolve);

    // Connect
    connection.on('error', reject);
    connection.connect(options);
  });
}

// ADd special title
function special(contest, title) {
  return title
    ? `${contest.special ? 'Special: ' : ''}${title}`
    : contest.special
      ? 'Special Election'
      : null;
}

// Export
module.exports = makePrintOutput;
