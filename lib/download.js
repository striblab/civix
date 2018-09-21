/**
 * Download and cache files
 */

// Dependencies
const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');
const crypto = require('crypto');
const unzipper = require('unzipper');
const request = require('request');
const cachedRequest = require('cached-request')(request);
const config = require('../config');
const debug = require('debug')('civix:download');

// Main class
class Downloader {
  constructor(options = {}) {
    this.options = options;

    // Cache directory
    this.cachePath = options.cachePath || config.cachePath;
    cachedRequest.setCacheDirectory(this.cachePath);
  }

  // Download
  async download(options = {}) {
    let o = _.extend({}, this.options, options);
    o.ttl = options.cache === false ? 0 : o.ttl || 1000 * 60 * 60;

    // Check options
    if (!o.url) {
      throw new Error('No "url" option provided to download.');
    }

    // Try to determine if zip
    if (o.zip !== false && o.url.match(/\.zip(\?|#|$)/i)) {
      debug(`Determined was a zip file: ${o.url}`);
      o.zip = true;
    }

    // Make hash of url for reference
    this.requestHash = this.hash(o);

    // Create output location
    this.outputDir = path.join(this.cachePath, this.requestHash);
    this.outputFile = path.join(
      this.outputDir,
      o.zip && !o.output.match(/\.zip$/i) ? `${o.output}.zip` : o.output
    );
    this.outputZipDir = path.join(
      this.outputDir,
      o.zip ? o.output.replace(/\.zip$/i, '') : o.output
    );
    fs.mkdirpSync(this.outputDir);
    if (o.zip) {
      fs.mkdirpSync(this.outputZipDir);
    }

    // Do request
    return new Promise((resolve, reject) => {
      // Output file
      let out = fs.createWriteStream(this.outputFile).on('error', reject);

      // Request
      let req = cachedRequest(o)
        .on('error', reject)
        .on('response', response => {
          if (response.statusCode >= 300) {
            reject(
              new Error(`Status code "${response.statusCode}" from "${o.url}"`)
            );
          }
        });

      // Unzip
      let un = unzipper
        .Extract({ path: this.outputZipDir })
        .on('error', reject);

      // Create pipeline.  Unsure how to save original zip file
      // and unzip it in the same stream.  TODO
      let pipeline = o.zip ? req.pipe(un) : req.pipe(out);
      pipeline.on('error', reject);

      // When all done
      pipeline.on('finish', () => {
        resolve({
          output: o.zip ? this.outputZipDir : this.outputFile,
          outputFile: this.outputFile
        });
      });
    });
  }

  // Make a hash
  hash(input) {
    return crypto
      .createHash('md5')
      .update(_.isString(input) ? input : JSON.stringify(input))
      .digest('hex');
  }
}

// Export
module.exports = {
  Downloader,
  download: async (options, dlOptions) => {
    let d = new Downloader(options);
    return await d.download(dlOptions);
  }
};
