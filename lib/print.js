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
const debug = require('debug')('civix:print');

// Metro area
const metroCounties = [
  '02',
  '10',
  '13',
  '19',
  '27',
  '30',
  '62',
  '70',
  '71',
  '82',
  '86'
];
const metroCountySmall = ['02', '10', '19', '27', '62', '70', '82'];

// Line separator
const lineSeparator = '\r\n';

// Default print config
const defaultSections = [
  {
    title: 'U.S. Senate',
    filename: 'ELEX_USSEN',
    filter: contest => {
      return (
        contest.office_id.match(/mn-us-senate-/i) &&
        contest.party_id.match(/(dfl|rep)/i)
      );
    },
    headings: contest => {
      return [
        `${contest.office_id.match(/class-1/i) ? 'Scheduled' : 'Special'}: ${
          contest.party.shortTitle
        }`
      ];
    }
  },
  {
    title: 'U.S. House',
    filename: 'ELEX_USHSE',
    filter: contest => {
      return (
        contest.office_id.match(/mn-us-house-/i) &&
        contest.party_id.match(/(dfl|rep)/i)
      );
    },
    headings: contest => {
      return [`${contest.office.shortTitle}: ${contest.party.shortTitle}`];
    }
  },
  {
    title: 'MN Governor',
    filename: 'ELEX_MNGOV',
    filter: contest => {
      return (
        contest.office_id.match(/mn-governor/i) &&
        contest.party_id.match(/(dfl|rep)/i)
      );
    },
    headings: contest => {
      return [`${contest.party.shortTitle}`];
    }
  },
  {
    title: 'MN Attorney General',
    filename: 'ELEX_MNAGEN',
    filter: contest => {
      return (
        contest.office_id.match(/mn-attorney-general/i) &&
        contest.party_id.match(/(dfl|rep)/i)
      );
    },
    headings: contest => {
      return [`${contest.party.shortTitle}`];
    }
  },
  {
    title: 'MN House',
    filename: 'ELEX_MNHSE',
    filter: contest => {
      return (
        contest.office_id.match(/mn-state-house/i) &&
        contest.party_id.match(/(dfl|rep)/i)
      );
    },
    headings: contest => {
      return [`${contest.office.shortTitle}: ${contest.party.shortTitle}`];
    }
  },
  {
    title: 'MN Judicial',
    filename: 'ELEX_MNJUD',
    filter: contest => {
      return contest.office_id.match(/mn-.*-court/i);
    },
    headings: contest => {
      return [
        `${contest.office.shortTitle.replace(/seat\s[0-9]+/i, '').trim()}: ${
          contest.office.seatName
        }`
      ];
    }
  },
  {
    title: 'Metro Local Races',
    filename: 'ELEX_METCITY',
    filter: contest => {
      return (
        contest.sourceData &&
        contest.sourceData['mn-elections-api'] &&
        contest.sourceData['mn-elections-api'].data &&
        contest.sourceData['mn-elections-api'].data.metro &&
        contest.sourceData['mn-elections-api'].data.type === 'local'
      );
    },
    headings: contest => {
      let d = contest.sourceData['mn-elections-api'].data;

      return [
        `${d.area.replace(/city of/i, '').trim()}`,
        `${d.name}${d.subArea ? ' ' + d.subArea : ''}`
          .replace(/council member/i, 'City Council')
          .replace(/special election for/i, 'Special:')
          .trim()
      ];
    }
  },
  {
    title: 'Metro School Board',
    filename: 'ELEX_METSKUL',
    filter: contest => {
      return (
        contest.sourceData &&
        contest.sourceData['mn-elections-api'] &&
        contest.sourceData['mn-elections-api'].data &&
        contest.sourceData['mn-elections-api'].data.metro &&
        contest.sourceData['mn-elections-api'].data.name.match(/school board/i)
      );
    },
    headings: contest => {
      let d = contest.sourceData['mn-elections-api'].data;

      return [
        `${d.area.replace(/\((i|s)sd\s#[0-9]+\)/i, '').trim()}`,
        `${d.name}${d.seatName ? ' ' + d.seatName : ''}${
          d.subArea ? ' ' + d.subArea : ''
        }`
          .replace(/(for\s)?school board member/i, '')
          .replace(/^\s*at large/i, 'At Large')
          .trim()
      ];
    }
  },
  {
    title: 'Metro School Questions',
    filename: 'ELEX_METQUE',
    filter: contest => {
      return (
        contest.sourceData &&
        contest.sourceData['mn-elections-api'] &&
        contest.sourceData['mn-elections-api'].data &&
        contest.sourceData['mn-elections-api'].data.metro &&
        contest.sourceData['mn-elections-api'].data.name.match(/school/i) &&
        contest.sourceData['mn-elections-api'].data.question === true
      );
    },
    headings: contest => {
      let d = contest.sourceData['mn-elections-api'].data;

      return [`${d.area.replace(/\((i|s)sd\s#[0-9]+\)/i, '').trim()}`];
    }
  },
  {
    title: 'Metro County Races',
    filename: 'ELEX_METCTY',
    filter: contest => {
      return (
        contest.sourceData &&
        contest.sourceData['mn-elections-api'] &&
        contest.sourceData['mn-elections-api'].data &&
        contest.sourceData['mn-elections-api'].data.metroSevenCounty &&
        contest.sourceData['mn-elections-api'].data.type.match(/county/i)
      );
    },
    headings: contest => {
      let d = contest.sourceData['mn-elections-api'].data;

      return [
        `${d.area.replace(/\((i|s)sd\s#[0-9]+\)/i, '').trim()}`,
        `${d.name}${d.seatName ? ' ' + d.seatName : ''}${
          d.subArea ? ' ' + d.subArea : ''
        }`
          .replace(/^county /i, '')
          .trim()
      ];
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
    let output = makeSection(section, contests);
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
function makeSection(section, contests) {
  let filtered = _.filter(contests, section.filter);
  let output = '';
  let previousHeadings;

  filtered.forEach(c => {
    // Headings
    let headings = section.headings(c);
    output += outputHeadings(headings, previousHeadings);
    previousHeadings = headings;

    // Meta
    output += outputMeta(c);

    // Results
    output += outputResults(c);
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
    output += `${printTags.question}${contest.questionText.replace(
      /\s+/gm,
      ' '
    )}${lineSeparator}`;
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
function outputResults(contest) {
  let output = '';

  // Check for ranked choice
  if (contest.voteType === 'ranked-choice') {
    return outputRankedChoiceResults(contest);
  }

  // TODO: Handle ranked choice
  contest.results.forEach(r => {
    output += `${printTags.candidate}${
      r.winner ? '<saxo:ch value="226 136 154"/>' : ''
    }\t${outputName(r.candidate)}${r.incumbent ? ' (i)' : ''}\t${(
      r.votes || 0
    ).toLocaleString()}\t${Math.round(
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
        rowParts.push(`${Math.round((totals.percent || 0) * 100)}%`);
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

  let contests = await models.Contest.findAll({
    where: {
      election_id: options.electionId,
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
      ],
      [{ model: models.Result, as: 'subResults' }, 'percent', 'DESC'],
      [
        { model: models.Result, as: 'subResults' },
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
        // Just top results
        where: { subResult: false },
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
        model: models.Result,
        attributes: { exclude: ['sourceData'] },
        // Sub results
        where: { subResult: true },
        as: 'subResults',
        required: false,
        include: [
          {
            model: models.Candidate,
            attributes: { exclude: ['sourceData'] }
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

    // Group sub results
    p.subResults = _.mapValues(_.groupBy(p.subResults, 'division_id'), g =>
      _.groupBy(g, 'boundary_version_id')
    );

    return p;
  });
}

// Create output directoy
function makeOutputPath(options = {}) {
  if (!options.electionId) {
    throw new Error('electionsId is needed for print output.');
  }

  let now = options.now || moment();
  let outputPath = path.join(
    config.exportPath,
    options.electionId,
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

// Export
module.exports = makePrintOutput;
