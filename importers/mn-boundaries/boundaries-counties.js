/**
 * Source:
 * https://gisdata.mn.gov/dataset/bdry-counties-in-minnesota
 */
/**
 * Importer for core data: Boundary: MN Counties
 *
 * From Minnesota Geospatial Commons: https://gisdata.mn.gov/dataset/bdry-counties-in-minnesota
 */

// Dependencies
const _ = require('lodash');
const path = require('path');
const shapefile = require('shapefile');
const reproject = require('reproject');
const epsg = require('../../lib/epsg.js');
const ensureMNGeoSource = require('./source-mn-geo-commons.js');

// Import function
module.exports = async function coreDataDivisionsImporter({
  logger,
  models,
  db
}) {
  logger('info', 'Core data: Boundary: MN Counties importer...');
  let updates = [];

  // Wrap in transaction
  return db.sequelize
    .transaction({}, t => {
      // Start promise chain
      return ensureMNGeoSource({ models, transaction: t }).then(mnGeoSource => {
        updates = updates.concat([mnGeoSource]);

        return getShapes().then(counties => {
          return importStates({
            counties,
            db,
            transaction: t,
            models,
            source: mnGeoSource[0]
          }).then(results => {
            updates = updates.concat(results);
          });
        });
      });
    })
    .then(results => {
      updates.forEach(u => {
        logger(
          'info',
          `[${u[0].constructor.name}] ${u[1] ? 'Created' : 'Existed'}: ${
            u[0].dataValues.id
          }`
        );
      });
    })
    .catch(error => {
      logger('error', 'Transaction rolled back; no data changes were made.');
      logger('error', error.stack ? error.stack : error);
    });
};

// Get shapes
async function getShapes() {
  // Get EPSG
  let sourceEPSG = await epsg('EPSG:26915');

  return new Promise((resolve, reject) => {
    let collected = [];

    shapefile
      .open(
        path.join(
          __dirname,
          'data',
          'boundaries-counties',
          'shp_bdry_counties_in_minnesota',
          'mn_county_boundaries_multipart.shp'
        )
      )
      .then(source =>
        source.read().then(async function collect(result) {
          if (result.done) {
            return resolve(collected);
          }
          // Reproject and add CRS
          let r = reproject.reproject(result.value, sourceEPSG, 'EPSG:4326');
          r.geometry.crs = { type: 'name', properties: { name: 'EPSG:4326' } };

          // Needs to be MultiPolygon
          if (r.geometry.type === 'Polygon') {
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

// Import states
function importStates({ counties, db, transaction, models, source }) {
  return Promise.all(
    counties.map(s => {
      let p = s.properties;
      // FIPS is provided, but Minnesota ID is FIPS + 1 / 2
      let fips = p.COUNTYFIPS;
      let numfips = parseInt(fips, 10);
      let mnId = (numfips + 1) * 2;
      let boundaryId = `mn-county-${fips}`;
      // Date from source web page
      let boundaryVersionId = `2013-${boundaryId}`;

      // Create general boundary if needed
      return db
        .findOrCreateOne(models.Boundary, {
          transaction,
          where: { id: boundaryId },
          include: models.Boundary.__associations,
          defaults: {
            id: boundaryId,
            name: boundaryId,
            title: p.COUNTYNAME,
            localId: mnId,
            parent_id: 'state-mn',
            division_id: 'county',
            sourceData: {
              [source.get('id')]: {
                about:
                  'Civix importer, see specific version for original data.',
                url: 'https://gisdata.mn.gov/dataset/bdry-counties-in-minnesota'
              }
            }
          }
        })
        .then(b => {
          // Create specific version boundary
          return db.findOrCreateOne(models.BoundaryVersion, {
            transaction,
            where: { id: boundaryVersionId },
            include: models.BoundaryVersion.__associations,
            defaults: {
              id: boundaryVersionId,
              name: boundaryVersionId,
              localId: mnId,
              fips: fips,
              // From website
              start: new Date('2013-07-01'),
              end: null,
              geometry: s.geometry,
              boundary_id: b[0].get('id'),
              sourceData: {
                [source.get('id')]: {
                  properties: p,
                  url:
                    'https://gisdata.mn.gov/dataset/bdry-counties-in-minnesota'
                }
              }
            }
          });
        });
    })
  );
}
