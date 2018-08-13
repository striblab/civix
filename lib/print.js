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

  // Go through sections
  defaultSections.forEach(section => {
    let output = makeSection(section, contests);
    let filename = `${section.filename.toUpperCase()}_${options.now.format(
      'DDMMYY'
    )}_${options.now.format('HHmm')}.txt`;

    // Save file
    fs.writeFileSync(path.join(outputPath, filename), output);
  });
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

  console.log(output);
  return output;
}

// Ouput for headings.  If the heading is different, we output it
function outputHeadings(current, previous) {
  let output = '';

  current.forEach((h, hi) => {
    if (!previous || (previous[hi] && h !== previous[hi])) {
      output += `${printTags['heading' + (hi + 1)]}${h}\n`;
    }
  });

  return output;
}

// Make meta output
function outputMeta(contest) {
  output = '';

  // Reprting
  output += `${printTags.meta}${contest.reporting ||
    0} of ${contest.totalReporting || '-'} precincts (${Math.round(
    contest.totalReporting ? contest.reporting / contest.totalReporting : 0
  )}%)\n`;

  // Open seats

  // Question

  return output;
}

// Output results
function outputResults(contest) {
  let output = '';

  // TODO: Handle ranked choice
  contest.results.forEach(r => {
    output += `${printTags.candidate}${
      r.winner ? '<saxo:ch value="226 136 154"/>' : ''
    }\t${r.candidate.fullName}${r.incumbent ? ' (i)' : ''}\t${r.votes ||
      0}\t${Math.round(r.precent || 0)}%\n`;
  });

  return output;
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
  // let outputPath = [
  //   'print',
  //   now.format('YYYYMMDD-HHmmss'),
  //   section.filename
  //     ? section.filename.toUpperCase() +
  //       '_' +
  //       now.format('DDMMYY') +
  //       '_' +
  //       now.format('HHmm') +
  //       '.txt'
  //     : 'saxo-elections-' +
  //       utility.urlSafe(utility.makeID(section.title)) +
  //       '.txt'
  // ];
}

// Export
module.exports = makePrintOutput;
