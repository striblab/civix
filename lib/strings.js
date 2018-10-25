/**
 * String utilities
 */

// Dependencies
const _ = require('lodash');
const crypto = require('crypto');
const debug = require('debug')('civix:strings');

// Make id
function makeId(input) {
  if (!_.isString(input) || !input.toString) {
    return undefined;
  }
  input = input.toString();

  return _.kebabCase(removeStopWords(input)).toLowerCase();
}

// Make sort version of a string
function makeSort(input) {
  if (!_.isString(input) || !input.toString) {
    return undefined;
  }
  input = input.toString();

  // Add leading 0 to numbers
  input = input.replace(/([0-9]+)/g, (match, number) => {
    return number.padStart(10, '0');
  });

  // Remove articles
  input = input
    .trim()
    .replace(/^(a|the|an)\s+/i, '')
    .trim();

  return input.toLowerCase();
}

// Remove stop words
function removeStopWords(input) {
  if (!_.isString(input) || !input.toString) {
    return undefined;
  }
  input = input.toString();

  return input
    .replace(/(\s|^)(an|the|of|in|with|and)(\s|$)/i, '')
    .replace(/(\s|^)(a)(\s)/i, '')
    .replace(/\s+/, ' ');
}

// Wrapper to parse int
function parseInteger(input, runDebug = false) {
  if (_.isNumber(input)) {
    return input;
  }

  let p = parseInt(input, 10);

  if (_.isNaN(p)) {
    if (runDebug) {
      debug(`Unable to parse integer: "${input}"`);
    }
    return undefined;
  }

  return p;
}

// Wrapper to parse float
function parseFloatPoint(input, runDebug = false) {
  if (_.isNumber(input)) {
    return input;
  }

  let p = parseFloat(input, 10);

  if (_.isNaN(p)) {
    if (runDebug) {
      debug(`Unable to parse float: "${input}"`);
    }
    return undefined;
  }

  return p;
}

// Make random id
function randomId(long = false) {
  const id = crypto.randomBytes(16).toString('hex');
  return long ? id : id.substring(0, 8);
}

// Export
module.exports = {
  makeSort,
  makeId,
  removeStopWords,
  parseInteger,
  parseFloatPoint,
  randomId
};
