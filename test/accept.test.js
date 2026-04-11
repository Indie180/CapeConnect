const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

module.exports = [
  {
    name: 'login page contains the selected frontend design shell',
    run() {
      const html = read('login.html');

      assert.match(html, /Welcome Back/);
      assert.match(html, /class="login-page"/);
      assert.match(html, /Sign In/);
      assert.match(html, /js\/api-client\.js/);
    },
  },
  {
    name: 'signup page contains the same frontend design family',
    run() {
      const signup = read('signup.html');

      assert.match(signup, /Create Your Account/);
      assert.match(signup, /class="login-page signup-page"/);
      assert.match(signup, /password-requirements/);
      assert.match(signup, /js\/api-client\.js/);
    },
  },
  {
    name: 'core static pages for the chosen frontend flow exist',
    run() {
      const expectedPages = [
        'login.html',
        'signup.html',
        'choose-bus.html',
        'dashboard.html',
        'choose-fare.html',
        'ga-route-calculator.html',
        'profile.html',
      ];

      for (const page of expectedPages) {
        assert.equal(fs.existsSync(path.join(rootDir, page)), true, `${page} should exist`);
      }
    },
  },
];
