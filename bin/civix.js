#!/usr/bin/env node

/**
 * Command line interface for running things
 */

// Dependencies
const yargs = require('yargs');

// Load in sub-commands via modules
// https://github.com/yargs/yargs/blob/master/docs/advanced.md
const argv = yargs.commandDir('./sub-commands/').help().argv;
