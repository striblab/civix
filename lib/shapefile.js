/**
 * General method to get shapes out of a shapefile
 */

// Dependencies
const shapefile = require('shapefile');
const { reproject } = require('reproject');

// Main function
async function shapes(shapefilePath, options = {}) {
  options.forceMultiPolygon =
    options.forceMultiPolygon === undefined ? true : options.forceMultiPolygon;
  options.newProjection = options.newProjection || 'EPSG:4326';

  // REturn promise
  return new Promise((resolve, reject) => {
    let collected = [];

    shapefile
      .open(shapefilePath)
      .then(source =>
        source.read().then(function collect(result) {
          if (result.done) {
            return resolve(collected);
          }

          // Reproject and add CRS
          let r = result.value;
          if (options.originalProjection) {
            r = reproject(
              result.value,
              options.originalProjection,
              options.newProjection
            );
            r.geometry.crs = {
              type: 'name',
              properties: { name: options.newProjection }
            };
          }

          // Needs to be MultiPolygon
          if (options.forceMultiPolygon && r.geometry.type === 'Polygon') {
            r.geometry.type = 'MultiPolygon';
            r.geometry.coordinates = [r.geometry.coordinates];
          }

          collected.push(r);
          return source.read().then(collect);
        })
      )
      .catch(reject);
  });
}

// Export
module.exports = {
  shapes
};
