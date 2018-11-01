/**
 * Import for MN SoS: candidates
 */

// Dependencies
const _ = require('lodash');
const { importRecords } = require('../../lib/importing.js');
const { getFiles } = require('./lib/election-files.js');
const { makeSort } = require('../../lib/strings.js');
const { contestParser } = require('./lib/parse-contests.js');
const { parseFullName } = require('parse-full-name');
const debug = require('debug')('civix:importer:mn-candidates');

// AP level results
const apLevelResults = [
  'state',
  'us-house',
  'us-senate',
  'state-lower',
  'state-upper',
  'judicial',
  'judicial-district'
];

// Import function
module.exports = async function mnElectionsMNContestsImporter({
  logger,
  models,
  db,
  argv
}) {
  // Make sure election is given
  if (!argv.election) {
    throw new Error(
      'An election argument must be provided, for example --election="2018-11-06"'
    );
  }

  // By default, ignore AP
  if (argv.includeAp) {
    logger.info('Including AP level contests.');
  }

  // Get election
  let election = await models.Election.findOne({
    where: {
      id: `usa-mn-${argv.election.replace(/-/g, '')}`
    }
  });
  if (!election) {
    throw new Error(`Unable to find election: mn-${argv.election}`);
  }

  // Get files
  let files = await getFiles(election.get('date'), argv, { logger });

  // Records
  let records = [];

  // Go through files
  for (let file of files) {
    for (let ci in file.contests) {
      let c = file.contests[ci];

      // Exclude AP
      if (!argv.includeAp) {
        if (~apLevelResults.indexOf(file.type)) {
          continue;
        }
      }

      // Run through parsers
      //let commonParsed = commonParser(c);
      let parsedContest = await contestParser(c, {
        type: file.type,
        election,
        models,
        db
      });

      // If not parsed, then that means we are skipping it for a reason
      if (!parsedContest) {
        continue;
      }

      // Go through results/candidates
      for (let candidate of c) {
        // Look up party
        let party;
        // No party
        if (candidate.party.toLowerCase() === 'np' || !candidate.party) {
          party = await models.Party.findOne({
            where: { id: 'np' }
          });
        }
        else {
          party = await models.Party.findOne({
            where: { id: candidate.party.toLowerCase() }
          });
        }

        // Throw if no party found
        if (!party) {
          throw new Error(`Unable to find party: ${candidate.party}`);
        }

        // Candidate Id
        let id = `${parsedContest.contest.id}-${candidate.candidate}`;

        // Name parts
        candidate.candidateName = candidate.candidateName
          .replace(/\s+-\s+/g, '-')
          .replace(/\s+/g, ' ')
          .trim();
        let nameParts = parseFullName(candidate.candidateName);
        if (candidate.party.match(/^wi$/i)) {
          nameParts = {
            last: 'Write-in'
          };
        }
        if (nameParts.error && nameParts.error.length) {
          debug(
            `Unable to parse "${candidate.candidateName}": ${
              nameParts.error
            } | ${JSON.stringify(nameParts)}`
          );
        }

        // Create candidate record
        let candidateRecord = {
          id,
          name: id,
          party_id: party.get('id'),
          localId: candidate.candidate,
          first: _.filter([nameParts.first, nameParts.nick])
            .join(' ')
            .trim(),
          last: nameParts.last || undefined,
          middle: nameParts.middle || undefined,
          prefix: nameParts.prefix || undefined,
          suffix: nameParts.suffix || undefined,
          fullName: _.filter([
            nameParts.prefix,
            nameParts.first,
            nameParts.nick,
            nameParts.middle,
            nameParts.last,
            nameParts.suffix
          ])
            .join(' ')
            .trim(),
          // TODO
          shortName: _.filter([
            nameParts.first ? `${nameParts.first[0]}.` : '',
            nameParts.last
          ])
            .join(' ')
            .trim(),
          sort: makeSort(
            _.filter([nameParts.last, nameParts.first, nameParts.middle])
              .join(' ')
              .trim()
          ),
          sourceData: {
            'mn-sos-ftp': {
              about: 'Taken from results level data',
              data: candidate
            }
          }
        };

        records.push({
          model: models.Candidate,
          record: candidateRecord
        });
      }
    }
  }

  // Save records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
