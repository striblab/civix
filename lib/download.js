/**
 * Download and cache files
 */

// Dependencies
const path = require('path');
const url = require('url');
const fs = require('fs-extra');
const _ = require('lodash');
const Ftp = require('ftp');
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
    o.ftpChanged = _.isBoolean(o.ftpChanged) ? o.ftpChanged : true;

    // Check options
    if (!o.url) {
      throw new Error('No "url" option provided to download.');
    }

    // Try to determine if zip
    if (o.zip !== false && o.url.match(/\.zip(\?|#|$)/i)) {
      debug(`Determined was a zip file: ${o.url}`);
      o.zip = true;
    }

    // If output is not given, use URL
    if (!o.output) {
      o.output = o.url.split('/').pop();
    }

    // Make hash of url for reference
    this.requestHash = this.hash(o);

    // Create output location
    this.outputDir = path.join(this.cachePath, this.requestHash);
    this.downloadInfoFile = path.join(this.outputDir, 'info.json');
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

    // Load downloadInfo
    this.downloadInfo = this.downloadInfo || {};
    if (fs.existsSync(this.downloadInfoFile)) {
      this.downloadInfo = JSON.parse(
        fs.readFileSync(this.downloadInfoFile, 'utf-8')
      );
    }

    // Check if FTP
    o.ftp = o.ftp || o.url.match(/^ftp/i);

    // Some fake headers
    o.headers = _.extend(o.headers || {}, {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
      Pragma: 'no-cache',
      DNT: '1',
      'Accept-Language': 'en-US,en;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      Connection: 'keep-alive'
    });

    // Set options
    this.downloadInfo.options = o;

    // Do request
    return new Promise(async (resolve, reject) => {
      // Output file
      let out = fs.createWriteStream(this.outputFile).on('error', reject);

      // If we check if the file has changed, assume true
      let fileChanged = true;

      // Request
      let req;
      if (!o.ftp) {
        req = cachedRequest(o)
          .on('error', reject)
          .on('response', response => {
            if (response.statusCode >= 300) {
              reject(
                new Error(
                  `Status code "${response.statusCode}" from "${o.url}"`
                )
              );
            }
          });
      }
      else {
        // Get info about resource
        let ftpInfo = await this.ftpInfo(o.url);

        // If we want to check if changed and we have data to compare
        if (
          o.ftpChanged &&
          ftpInfo &&
          this.downloadInfo &&
          this.downloadInfo.ftpInfo
        ) {
          // Check if size or date has changed
          if (
            ftpInfo.size &&
            ftpInfo.size === this.downloadInfo.ftpInfo.size &&
            ftpInfo.date &&
            this.downloadInfo.ftpInfo.date &&
            new Date(ftpInfo.date).getTime() ===
              new Date(this.downloadInfo.ftpInfo.date).getTime()
          ) {
            debug(
              `${ftpInfo.size} === ${this.downloadInfo.ftpInfo.size}   ||  ${
                ftpInfo.date
              } === ${this.downloadInfo.ftpInfo.date}`
            );
            fileChanged = false;
          }
          else {
            fileChanged = true;
          }
        }

        // Update info
        this.downloadInfo.ftpInfo = ftpInfo;

        // TODO: Allow to use TTL and the cache
        req = await this.ftpStream(o.url);
      }

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
        // Save info
        if (this.downloadInfo) {
          fs.writeFileSync(
            this.downloadInfoFile,
            JSON.stringify(this.downloadInfo)
          );
        }

        // Resolve
        resolve({
          output: o.zip ? this.outputZipDir : this.outputFile,
          outputFile: this.outputFile,
          dlInfo: this.downloadInfoFile,
          fileChanged
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

  // FTP stream from URL
  async ftpStream(uri) {
    return new Promise((resolve, reject) => {
      // Parse URL
      let parts = url.parse(uri);
      let client = new Ftp();

      client.on('ready', () => {
        client.get(parts.pathname, (error, stream) => {
          if (error) {
            return reject(error);
          }

          stream.once('close', () => {
            client.end();
          });
          resolve(stream);
        });
      });

      client.connect({
        host: parts.hostname,
        port: parts.port || 21,
        user: parts.auth ? parts.auth.split(':')[0] : undefined,
        password: parts.auth ? parts.auth.split(':')[1] : undefined
      });
    });
  }

  // Get info about FTP resource, specifically for caching
  async ftpInfo(uri) {
    return new Promise((resolve, reject) => {
      // Parse URL
      let parts = url.parse(uri);
      let client = new Ftp();

      client.on('ready', () => {
        client.list(parts.pathname, (error, info) => {
          if (error) {
            return reject(error);
          }

          info = _.isArray(info) ? info[0] : undefined;
          resolve(info);
          client.end();
        });
      });

      client.connect({
        host: parts.hostname,
        port: parts.port || 21,
        user: parts.auth ? parts.auth.split(':')[0] : undefined,
        password: parts.auth ? parts.auth.split(':')[1] : undefined
      });
    });
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
