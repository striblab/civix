/**
 * String utilities
 */

// Dependencies
const _ = require('lodash');

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

// Export
module.exports = {
  makeSort,
  makeId,
  removeStopWords
};
