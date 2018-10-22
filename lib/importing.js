/**
 * Helpful methods around importing data
 */

// Dependencies
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const { union } = require('@turf/turf');
const shapefile = require('shapefile');
const reproject = require('./reproject.js');
const { download } = require('./download.js');
const debug = require('debug')('civix:importing');

/**
 * Import records
 *
 * Pass an array of objects like:
 * {
 *   model: model to use
 *   record: model data
 *   (optional) options: options for function, including where clause,
 *     or pick for updating
 *   (optional) post: function to do with record once in DB, should
 *     be a promise.
 * }
 *
 * And options like:
 * {
 *   update: update record, otherwise skip existing
 * }
 */
async function importRecords(records, { db, logger, options }) {
  // Check values
  if (!records || !records.length) {
    logger('info', 'No records passed to importRecords');
    return;
  }
  if (!db) {
    throw new Error('No db options passed to importRecords');
  }
  if (!logger) {
    throw new Error('No logger options passed to importRecords');
  }

  // Collect results
  let importResults = [];

  // Start transaction
  const transaction = await db.sequelize.transaction();

  try {
    // Go through each record
    for (let record of records) {
      if (record && record.record) {
        debug(record.record.id);

        let update = await db[
          options.update ? 'updateOrCreateOne' : 'findOrCreateOne'
        ](
          record.model,
          _.extend(record.options || {}, {
            transaction,
            where: { id: record.record.id },
            defaults: record.record
          })
        );
        importResults.push(update);

        if (record.post) {
          importResults.push(await record.post(update, { transaction }));
        }
      }
    }

    // All done, log
    _.filter(importResults).forEach(r => {
      if (_.isString(r)) {
        logger('info', r);
      }
      else if (_.isArray(r) && r[0]) {
        let op = r[1] ? 'Created' : options.update ? 'Updated' : 'Existed';
        logger(
          'info',
          `[${r[0].constructor.name}] ${op}: ${r[0].dataValues.id}`
        );
      }
    });

    // Commit
    await transaction.commit();
    logger('info', 'Transaction committed.');
  }
  catch (error) {
    transaction.rollback();
    logger('error', 'Transaction rolled back; no data changes were made.');
    logger('error', error.stack ? error.stack : error);
  }
}

// Download, group, and filter
async function processGeo({
  url,
  outputName,
  shapePath,
  inputProjection,
  outputProjection,
  filter,
  group,
  logger,
  ttl
}) {
  if (logger) {
    logger('info', 'Downloading file, could take a moment if not cached ...');
  }

  // Download
  let dl = await download({
    ttl: ttl || 1000 * 60 * 60 * 24 * 30,
    url: url,
    output: outputName
  });

  // Get data from download, if shapefile, otherwise assume geojson
  let districts;
  if (shapePath) {
    let pathToShape = path.join(dl.output, shapePath);
    districts = await readShapefile(pathToShape);
  }
  else {
    districts = JSON.parse(fs.readFileSync(dl.output, 'utf-8'));
  }

  // Filter
  if (filter) {
    districts.features = _.filter(districts.features, filter);
  }

  // Group
  if (group) {
    let grouped = _.groupBy(districts.features, group);
    districts.features = _.map(grouped, g => {
      return {
        type: 'Feature',
        properties: _.extend(g[0].properties, {
          fullGroup: _.cloneDeep(_.map(g, 'properties'))
        }),
        geometry: g.length > 1 ? union(...g).geometry : g[0].geometry
      };
    });
  }

  // Reproject and multipolygon
  for (let fi in districts.features) {
    if (inputProjection) {
      districts.features[fi] = await reproject(
        districts.features[fi],
        inputProjection,
        outputProjection || 'EPSG:4326'
      );
    }

    if (districts.features[fi].geometry.type === 'Polygon') {
      districts.features[fi].geometry.type = 'MultiPolygon';
      districts.features[fi].geometry.coordinates = [
        districts.features[fi].geometry.coordinates
      ];
    }
  }

  return districts;
}

// Async wrapper to get shapefile contents
async function readShapefile(shapePath) {
  // REturn promise
  return new Promise((resolve, reject) => {
    let collected = [];

    shapefile
      .open(shapePath)
      .then(source =>
        source.read().then(function collect(result) {
          if (result.done) {
            return resolve({
              type: 'FeatureCollection',
              features: collected
            });
          }

          collected.push(result.value);
          return source.read().then(collect);
        })
      )
      .catch(reject);
  });
}

// Export
module.exports = {
  importRecords,
  processGeo,
  readShapefile
};
