const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

module.exports = [
  {
    name: 'landing page contains the app mount point and project title',
    run() {
      const html = read('index.html');

      assert.match(html, /<div id="app"><\/div>/);
      assert.match(html, /<title>CapeConnect - Complete Transit System<\/title>/);
    },
  },
  {
    name: 'quickstart documents the key passenger flow pages',
    run() {
      const quickstart = read('QUICKSTART.md');

      assert.match(quickstart, /Route Calculator/);
      assert.match(quickstart, /Choose Fare/);
      assert.match(quickstart, /Results/);
      assert.match(quickstart, /Payment/);
    },
  },
  {
    name: 'core static pages for login and booking flows exist',
    run() {
      const expectedPages = [
        'login.html',
        'signup.html',
        'booking.html',
        'payment.html',
        'results.html',
        'ga-booking.html',
        'ga-payment.html',
        'ga-results.html',
      ];

      for (const page of expectedPages) {
        assert.equal(fs.existsSync(path.join(rootDir, page)), true, `${page} should exist`);
      }
    },
  },
];
