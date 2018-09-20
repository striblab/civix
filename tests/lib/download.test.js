// To test
const { Downloader, download } = require('../../lib/download.js');

// Global test functions
/* global describe, test, expect */

// Dependencies for testing
const path = require('path');
const fs = require('fs');

// Tests
describe('downloader', () => {
  // Can make object
  test('can instantiate', () => {
    let d = new Downloader();
    expect(d);
  });

  // Simple download
  test('can download file', async () => {
    let d = new Downloader({
      cachePath: path.join(__dirname, '.cache')
    });
    let options = {
      ttl: 1,
      url:
        'https://raw.githubusercontent.com/striblab/strib-icons/master/README.md',
      output: 'README.dl.md'
    };
    let i = await d.download(options);

    expect(i).toHaveProperty('output');
    expect(fs.existsSync(i.output)).toBe(true);
  });

  // Can download and unzip
  test('can download and unzip file', async () => {
    let d = new Downloader({
      cachePath: path.join(__dirname, '.cache')
    });
    let options = {
      ttl: 30 * 1000,
      url: 'https://github.com/striblab/strib-icons/archive/master.zip',
      output: 'master-test'
    };
    let i = await d.download(options);

    expect(i).toHaveProperty('output');
    expect(fs.existsSync(i.output)).toBe(true);
    expect(
      fs.existsSync(path.join(i.output, 'strib-icons-master', 'README.md'))
    ).toBe(true);
  });
});
