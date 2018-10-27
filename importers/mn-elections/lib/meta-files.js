/**
 * Get meta files
 */

// Dependencies
const fs = require('fs');
const _ = require('lodash');
const semiSV = require('d3-dsv').dsvFormat(';');
const config = require('../../../config/index.js');
const { download } = require('../../../lib/download.js');
const { parseInteger } = require('../../../lib/strings.js');
const debug = require('debug')('civix:mn-elections:election-files');

// Election files
let elections = {
  20181106: [
    {
      file: 'BallotQuestions.txt',
      type: 'questions',
      parseRow: i => {
        return {
          county: i[0].padStart(2, '0'),
          countyFips: parseInteger(i[0])
            ? (parseInteger(i[0]) * 2 - 1).toString().padStart(3, '0')
            : undefined,
          contest: i[1],
          mcd: i[2],
          school: i[3],
          contestName: i[4],
          questionTitle: i[5],
          questionText: i[6]
            .replace(/&bull\^/gi, '')
            .replace(/\^\s/gi, '; ')
            .replace(/\n/g, '  ')
            .replace(/\s{3,}/g, '  ')
            .replace(/"|“|"/g, '')
            .trim()
            .replace(/(by\s+voting\s+|passage\s+of\s+this\s+ref).*$/i, '')
            .trim()
        };
      }
    },
    {
      file: 'mcdtbl.txt',
      type: 'district-local',
      parseRow: i => {
        return {
          county: i[0].padStart(2, '0'),
          countyFips: parseInteger(i[0])
            ? (parseInteger(i[0]) * 2 - 1).toString().padStart(3, '0')
            : undefined,
          countyName: i[1],
          mcd: i[2].padStart(5, '0'),
          mcdName: i[3]
        };
      }
    },
    {
      file: 'SchoolDistTbl.txt',
      type: 'district-school',
      parseRow: i => {
        return {
          county: i[2].padStart(2, '0'),
          countyFips: parseInteger(i[2])
            ? (parseInteger(i[2]) * 2 - 1).toString().padStart(3, '0')
            : undefined,
          countyName: i[3],
          school: i[0].padStart(4, '0'),
          schoolName: i[1],
          schoolType: i[1].match(/minneapolis|south.*st.*paul/i) ? '03' : '01'
        };
      }
    }
  ]
};

// Get file from
async function getFile(election, file) {
  debug(`Fetching ${file.file} from ${election}.`);

  // Download
  let dl = await download({
    url: `ftp://${config.mnSosFtpUser}:${
      config.mnSosFtpPass
    }@ftp.sos.state.mn.us/${election.replace(/-/g, '')}/${file.file}`
  });

  // Read contents
  let contents = fs.readFileSync(dl.output, 'utf-8');

  // Parse
  let parsed = semiSV.parseRows(contents, file.parseRow);

  return parsed;
}

// Get all files for an election
async function getFiles(election, options = {}) {
  let files = elections[election.replace(/-/g, '')];
  if (!files) {
    throw new Error(`Unable to find files for election: ${election}`);
  }

  for (let file of files) {
    file.data = await getFile(election, file, options);
  }

  return _.keyBy(files, 'type');
}

// Export
module.exports = {
  elections,
  getFile,
  getFiles
};
