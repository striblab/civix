/**
 * Get EPSG info.
 */

// Dependencies
const fs = require('fs-extra');
const json = require('json5');
const path = require('path');
const request = require('request');
const config = require('../config');

// Main async function
module.exports = async function epsg(code, noCache = false) {
  code = code.replace(/^epsg[:]*/i, '');
  let cachePath = path.join(config.cachePath, 'epsg.json');
  let cache = {};

  // Check cache
  fs.mkdirpSync(config.cachePath);
  if (!noCache && fs.existsSync(cachePath)) {
    cache = json.parse(fs.readFileSync(cachePath, 'utf-8'));
  }

  return new Promise((resolve, reject) => {
    // Check cache
    if (!noCache && cache[code] === false) {
      reject(
        new Error(
          `[with cache] Unable to find definition for EPSG code: ${code}`
        )
      );
    }
    else if (!noCache && cache[code]) {
      return resolve(cache[code]);
    }

    // Not in cache, check sites
    request.get(
      `http://www.spatialreference.org/ref/epsg/${code}/proj4/`,
      (error, response, body) => {
        if (!error && response.statusCode < 300) {
          cache[code] = body;
          fs.writeFileSync(cachePath, json.stringify(cache));
          return resolve(body);
        }

        // Error, so try epsg
        request.get(`http://epsg.io/${code}.proj4`, (error, response, body) => {
          if (!error && response.statusCode < 300) {
            cache[code] = body;
            fs.writeFileSync(cachePath, json.stringify(cache));
            return resolve(body);
          }

          // Error
          cache[code] = false;
          fs.writeFileSync(cachePath, json.stringify(cache));
          reject(
            new Error(
              `Unable to find definition from sources for EPSG code: ${code}`
            )
          );
        });
      }
    );
  });
};
