const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

module.exports = [
  {
    name: 'index.html redirects to the screenshot-based login page',
    run() {
      const html = read('index.html');
      assert.match(html, /http-equiv="refresh"/i);
      assert.match(html, /url=login\.html/i);
    },
  },
  {
    name: 'auth page scripts and styles exist',
    run() {
      const loginHtml = read('login.html');
      const signupHtml = read('signup.html');
      const authPagesScript = read('js/auth-pages.js');

      assert.match(loginHtml, /css\/styles\.css/);
      assert.match(signupHtml, /css\/styles\.css/);
      assert.match(loginHtml, /js\/auth-pages\.js/);
      assert.match(signupHtml, /js\/auth-pages\.js/);
      assert.match(authPagesScript, /window\.App\s*=/);
      assert.match(authPagesScript, /window\.handleLogin\s*=/);
      assert.match(authPagesScript, /window\.handleSignup\s*=/);
    },
  },
];
