/**
 * Wrapper around reproject
 */

// Dependencies
const { reproject } = require('reproject');
const epsg = require('./epsg.js');

// Main function
async function reprojectWrapper(
  feature,
  oldProjection,
  newProjection = 'EPSG:4326'
) {
  if (!feature) {
    throw new Error('Feature not provided to reproject.');
  }

  if (!oldProjection) {
    throw new Error('Old projection not provided to reproject.');
  }

  if (oldProjection === newProjection) {
    return feature;
  }

  oldProjection = await epsg(oldProjection);
  let newProjectionName = newProjection;
  newProjection = await epsg(newProjection);

  let newFeature = reproject(feature, oldProjection, newProjection);
  newFeature.geometry.crs = {
    type: 'name',
    properties: { name: newProjectionName }
  };

  return newFeature;
}

// Exports
module.exports = reprojectWrapper;
