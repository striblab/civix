/**
 * Wrapper to run elex commands
 */

// Dependencies
const _ = require('lodash');
const json = require('json5');
const spawnSync = require('child_process').spawnSync;
const commandExistsSync = require('command-exists').sync;
const config = require('../config');
const debug = require('debug')('civix:elex');

// Class for elex
class Elex {
  // Constructor
  constructor(options = {}) {
    this.options = options;
    this.defaultElection = options.defaultElection;

    this.checkCommand();
    this.checkEnvironment();
  }

  // Check for elex command
  checkCommand() {
    if (!commandExistsSync('elex')) {
      throw new Error('Unable to find the elex command in the environment.');
    }
  }

  // Check for environment variable, config will take it from .env
  checkEnvironment() {
    if (!process.env.AP_API_KEY) {
      throw new Error(
        'Unable to find the AP_API_KEY variable in the environment or in Civix config.'
      );
    }
  }

  // Secure command
  secureCommand(command) {
    return command.replace(/^AP_API_KEY=[a-z0-9]+\s+/i, 'AP_API_KEY=XXXX ');
  }

  // Get races
  races(options = {}) {
    options.election = options.election || this.defaultElection;

    // Check election
    if (!options.election) {
      throw new Error(
        'No election option or defaultElection provided to run races.  This should be something like 2018-08-14'
      );
    }

    return this.runCommand(['races', options.election, '-o', 'json'], options);
  }

  // Get results
  results(options = {}) {
    options.election = options.election || this.defaultElection;

    // Check election
    if (!options.election) {
      throw new Error(
        'No election option or defaultElection provided to run races.  This should be something like 2018-08-14'
      );
    }

    return this.runCommand(
      ['results', options.election, '-o', 'json'],
      options
    );
  }

  // Run command
  runCommand(args, options = {}) {
    options.json = options.json === false ? options.json : true;

    // General options
    if (config.elexTest) {
      args.push('--test');
    }

    // Create options
    let command = `elex ${args.join(' ')}`;
    debug(command);

    // Run command.  Note that elex will exit with 1 on error, 0 on API call, and 64 on cache
    let output;
    try {
      output = spawnSync('elex', args, {
        env: process.env
      });
    }
    catch (e) {
      this.options.logger(
        'error',
        `Error running '${this.secureCommand(command)}'`
      );
      this.options.logger('error', e);
      throw e;
    }

    if (output.status && output.status === 1) {
      throw new Error(
        `Errors running '${this.secureCommand(command)}, return ${
          output.status
        }' \n  ${output.stderr}`
      );
    }

    // Make sure we have some output
    if (!output.stdout) {
      throw new Error(
        `Running '${this.secureCommand(command)}' produced empty output.`
      );
    }

    // Parse json
    if (options.json) {
      try {
        return json.parse(output.stdout);
      }
      catch (e) {
        if (this.options.logger) {
          this.options.logger(
            'error',
            `Unable to parse output from '${this.secureCommand(command)}'`
          );
          throw e;
        }
      }
    }

    return output.stdout;
  }
}

// Export a generator
function elexGenerator(options = {}) {
  return new Elex(options);
}
elexGenerator.Elex = Elex;

module.exports = elexGenerator;