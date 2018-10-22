/**
 * Describes files on the MN SoS FTP site
 */

// Dependencies
const fs = require('fs');
const _ = require('lodash');
const semiSV = require('d3-dsv').dsvFormat(';');
const config = require('../../../config/index.js');
const { download } = require('../../../lib/download.js');
const { makeId } = require('../../../lib/strings.js');
const debug = require('debug')('civix:mn-elections:election-files');

// Election files
let elections = {
  20181106: [
    {
      file: 'attorneygen.txt',
      type: 'state'
    },
    {
      file: 'auditor.txt',
      type: 'state'
    },
    {
      file: 'secofstate.txt',
      type: 'state'
    },
    {
      file: 'Governor.txt',
      type: 'state'
    },
    {
      file: 'ussenate.txt',
      type: 'us-senate'
    },
    {
      file: 'ushouse.txt',
      type: 'us-house'
    },
    {
      file: 'judicialdst.txt',
      type: 'judicial-district'
    },
    {
      file: 'judicial.txt',
      type: 'judicial'
    },
    {
      file: 'LegislativeByDistrict.txt',
      type: 'state-lower'
    },
    {
      file: 'stsenate.txt',
      type: 'state-upper'
    },
    {
      file: 'local.txt',
      type: 'local'
    },
    {
      file: 'SDRaceQuestions.txt',
      type: 'school'
    },
    {
      file: 'cntyRaceQuestions.txt',
      type: 'county'
    },
    {
      file: 'hospital.txt',
      type: 'hospital'
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
  let parsed = semiSV.parseRows(contents, d => {
    return {
      state: d[0],
      county: d[1],
      precinct: d[2],
      contest: d[3],
      contestName: d[4],
      district: d[5],
      candidate: d[6],
      candidateName: d[7],
      // Not usually filled in
      suffix: d[8],
      // Not usually filled in
      incumbent: d[9],
      party: d[10],
      precincts: d[11] ? parseInt(d[11], 10) : undefined,
      totalPrecincts: d[12] ? parseInt(d[12], 10) : undefined,
      votes: d[13] ? parseInt(d[13], 10) : undefined,
      percent: d[14] ? parseFloat(d[14]) : undefined,
      totalVotes: d[15] ? parseInt(d[15], 10) : undefined,
      id: makeId(`${d[0]} ${d[1]} ${d[3]}-${d[5]}`)
    };
  });

  // Group by contest
  parsed = _.groupBy(parsed, 'id');

  return parsed;
}

// Get all files for an election
async function getFiles(election) {
  let files = elections[election.replace(/-/g, '')];
  if (!files) {
    throw new Error(`Unable to find files for election: ${election}`);
  }

  for (let file of files) {
    file.contests = await getFile(election, file);
  }

  return files;
}

// Export
module.exports = {
  elections,
  getFile,
  getFiles
};
