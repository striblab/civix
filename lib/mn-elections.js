/**
 * Wrapper to run mn-elections commands
 * https://github.com/striblab/mn-elections-api
 */

// Dependencies
const fs = require('fs-extra');
const path = require('path');
//const _ = require('lodash');
const json = require('json5');
const spawnSync = require('child_process').spawnSync;
const commandExistsSync = require('command-exists').sync;
const config = require('../config');
const debug = require('debug')('civix:mn-elections');

// Class for mn-elections
class MNElections {
  // Constructor
  constructor(options = {}) {
    this.options = options;
    this.defaultElection = options.defaultElection;
    this.outputPath =
      options.outputPath || path.join(config.cachePath, 'mn-elections-output');

    this.checkCommand();
    this.checkEnvironment();
  }

  // Check for command
  checkCommand() {
    if (!commandExistsSync('mn-elections')) {
      throw new Error(
        'Unable to find the mn-elections command in the environment.'
      );
    }
  }

  // Check for environment variable, config will take it from .env
  checkEnvironment() {
    // TODO: change to MN_
    if (!process.env.SOS_FTP_USER) {
      throw new Error(
        'Unable to find the SOS_FTP_USER variable in the environment or in Civix config.'
      );
    }
    if (!process.env.SOS_FTP_PASS) {
      throw new Error(
        'Unable to find the SOS_FTP_PASS variable in the environment or in Civix config.'
      );
    }

    // Try to create directory
    try {
      fs.mkdirpSync(this.outputPath);
    }
    catch (e) {
      throw new Error(
        `Unable to create path for mn-elections output. ${
          this.outputPath
        } \n ${e}`
      );
    }
  }

  // Get results
  results(options = {}) {
    options.election = options.election || this.defaultElection;

    // Check election
    if (!options.election) {
      throw new Error(
        'No election option or defaultElection provided to run results.  This should be something like 20180814'
      );
    }

    // Run command
    this.runCommand(
      ['results', '--election', options.election, '--output', this.outputPath],
      options
    );

    // Get output
    let resultsPath = path.join(
      this.outputPath,
      options.election,
      'results',
      'all.json'
    );

    // Check for file
    if (!fs.existsSync(resultsPath)) {
      throw new Error(`Unable to find the results file at; ${resultsPath}`);
    }

    // Parse json
    try {
      return json.parse(fs.readFileSync(resultsPath), 'utf-8');
    }
    catch (e) {
      if (this.options.logger) {
        this.options.logger(
          'error',
          `Unable to parse output from file at: ${resultsPath}`
        );
        throw e;
      }
    }
  }

  // Run command
  runCommand(args, options = {}) {
    // Test options
    if (config.testResults) {
      this.options.logger(
        'info',
        `mn-elections-api: using test data: ${config.mnElectionsTestLevel ||
          'middle'}`
      );
      args.push('--test');
      args.push(config.mnElectionsTestLevel || 'middle');
    }

    // Create options
    let command = `mn-elections ${args.join(' ')}`;
    debug(command);

    // Run command.
    let output;
    try {
      output = spawnSync('mn-elections', args, {
        env: process.env
      });
    }
    catch (e) {
      this.options.logger('error', `Error running '${command}'`);
      this.options.logger('error', e);
      throw e;
    }

    if (output.status && output.status >= 1) {
      throw new Error(
        `Errors running '${command}, return ${output.status}' \n  ${
          output.stderr
        }`
      );
    }
  }
}

// Export a generator
function mnElectionsGenerator(options = {}) {
  return new MNElections(options);
}
mnElectionsGenerator.MNElections = MNElections;

module.exports = mnElectionsGenerator;
