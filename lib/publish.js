/**
 * Publish civix exports to S3
 */

// Depedencies
const url = require('url');
const s3 = require('s3');
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('civix:publish');

// Main function
module.exports = async function civixPublisher(options = {}) {
  // Defaults
  options.cacheSeconds = options.cacheSeconds || 30;
  options.s3Region = options.s3Region || 'us-east-1';
  options.deleteRemoved = !!options.deleteRemoved;

  // Check for s3 path
  if (!options.s3Location) {
    throw new Error('s3Location option not provided to publisher.');
  }

  // Check parts
  let s3Location;
  try {
    s3Location = url.parse(options.s3Location);
    debug('Parsed s3 location:', s3Location);
  }
  catch (e) {
    throw e;
  }
  if (s3Location.protocol !== 's3:') {
    throw new Error(
      's3Location option provided to publisher does not use the s3:// protocol.'
    );
  }

  // Setup s3 client
  let s3Client = s3.createClient({
    maxAsyncS3: 20,
    s3RetryCount: 5,
    s3RetryDelay: 750,
    s3Options: {
      // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property
      region: options.s3Region
    }
  });

  // Prefix
  let prefix =
    s3Location.pathname.replace(/^\/+/g, '').replace(/\/+$/g, '') + '/';

  // Throttle debugger
  let throttleDebug = _.throttle(debug, 2000, { leading: true });

  // Wrap in promise
  return new Promise((resolve, reject) => {
    // OPtions for uploader
    let uploadOptions = {
      localDir: options.exportsPath,
      // Clobbers
      deleteRemoved: options.deleteRemoved,
      s3Params: {
        // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
        Bucket: s3Location.hostname,
        Prefix: prefix,
        ACL: 'public-read',
        CacheControl:
          'public, max-age=' + options.cacheSeconds + ', must-revalidate',
        Expires: moment()
          .add(options.cacheSeconds, 'seconds')
          .toDate()
      }
    };

    let uploader = s3Client.uploadDir(uploadOptions);
    uploader.on('error', reject);
    uploader.on('progress', function() {
      throttleDebug(
        's3 progress:',
        uploader.progressTotal
          ? uploader.progressAmount / uploader.progressTotal
          : 0
      );
    });
    uploader.on('end', function() {
      resolve();
    });
  });
};
