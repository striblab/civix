/**
 * Utility around collections (objects/arrays)
 */

// Dependencies
const _ = require('lodash');

// Recursive clean object
function pruneEmpty(obj, removeSource = true) {
  return (function prune(current) {
    _.forOwn(current, function(value, key) {
      if (
        _.isUndefined(value) ||
        _.isNull(value) ||
        _.isNaN(value) ||
        (!_.isDate(value) && _.isString(value) && _.isEmpty(value)) ||
        (!_.isDate(value) && _.isObject(value) && _.isEmpty(prune(value))) ||
        (removeSource && key === 'sourceData')
      ) {
        delete current[key];
      }
    });
    // remove any leftover undefined values from the delete
    // operation on an array
    if (_.isArray(current)) _.pull(current, undefined);

    return current;
  })(_.cloneDeep(obj)); // Do not modify the original object, create a clone instead
}

// Filter object and keep keys
function filterValues(object, filter) {
  filter = filter || _.identity;
  return Object.keys(object).reduce(function(x, key) {
    var value = object[key];
    if (filter(value)) {
      x[key] = value;
    }
    return x;
  }, {});
}

// Export
module.exports = {
  pruneEmpty,
  filterValues
};
