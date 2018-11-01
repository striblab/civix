/**
 * Describes files on the MN SoS FTP site
 */

// Dependencies
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const semiSVParse = require('csv-parse/lib/sync');
// Note that d3-dsv doesn't handle double quotes correctly
// and treats them as string delimiters
//const semiSV = require('d3-dsv').dsvFormat(';');
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
async function getFile(election, file, options = {}, { logger }) {
  debug(`Fetching ${file.file} from ${election}.`);

  // Download, check for fake files
  let contents;
  if (config.test && config.mnSosFakeFiles) {
    let fakeLocation =
      config.mnSosFakeFiles[
        Math.floor(Math.random() * config.mnSosFakeFiles.length)
      ];
    let fakeFile = path.join(fakeLocation, file.file);
    if (!fs.existsSync(fakeFile)) {
      throw new Error(`Could not load fake file: ${fakeFile}`);
    }

    logger.info(`Using fake file: ${fakeFile}`);
    contents = fs.readFileSync(fakeFile, 'utf-8');
  }
  else {
    let dl = await download({
      url: `ftp://${config.mnSosFtpUser}:${
        config.mnSosFtpPass
      }@ftp.sos.state.mn.us/${election.replace(/-/g, '')}/${file.file}`
    });

    // No change
    if (!options.ignoreCache && dl && dl.fileChanged === false) {
      debug(`File unchanged: ${file.file}`);
      return [];
    }

    // Read contents
    contents = fs.readFileSync(dl.output, 'utf-8');
  }

  // Wrapper around parseint and float to help with debugging
  const pInt = input => {
    if (!_.isNumber(input) && _.isNaN(parseInt(input, 10))) {
      debug(`Unable to parse integer from: ${input}`);
    }
    else {
      return parseInt(input, 10);
    }
  };
  const pFloat = input => {
    if (!_.isNumber(input) && _.isNaN(parseFloat(input))) {
      debug(`Unable to parse float from: ${input}`);
    }
    else {
      return parseFloat(input, 10);
    }
  };

  // Parse
  let parsed = semiSVParse(contents, {
    cast: false,
    cast_date: false,
    delimiter: ';',
    escape: null,
    quote: null,
    relax: true,
    skip_empty_lines: true,
    trim: true
  });

  // Check results
  parsed = _.filter(parsed, d => {
    if (d.length !== 16) {
      debug(d);
      return false;
    }

    return true;
  });

  // Put into an object and parse
  parsed = _.map(parsed, d => {
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
      precincts: pInt(d[11]),
      totalPrecincts: pInt(d[12]),
      votes: pInt(d[13]),
      percent: pFloat(d[14]),
      totalVotes: pInt(d[15]),
      id: makeId(`${d[0]} ${d[1]} ${d[3]}-${d[5]}`)
    };
  });

  // Group by contest
  parsed = _.groupBy(parsed, 'id');

  return parsed;
}

// Get all files for an election
async function getFiles(election, options = {}, { logger }) {
  let files = elections[election.replace(/-/g, '')];
  if (!files) {
    throw new Error(`Unable to find files for election: ${election}`);
  }

  for (let file of files) {
    file.contests = await getFile(election, file, options, { logger });
  }

  return files;
}

// Export
module.exports = {
  elections,
  getFile,
  getFiles
};
