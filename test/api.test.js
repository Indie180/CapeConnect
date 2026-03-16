const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

module.exports = [
  {
    name: 'index.html includes the core static app assets',
    run() {
      const html = read('index.html');

      const expectedAssets = [
        'styles/main.css',
        'js/config.js',
        'js/router.js',
        'js/auth.js',
        'js/api.js',
        'js/components.js',
        'js/pages.js',
        'js/app.js',
      ];

      for (const asset of expectedAssets) {
        assert.match(html, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.equal(fs.existsSync(path.join(rootDir, asset)), true, `${asset} should exist`);
      }
    },
  },
  {
    name: 'core browser scripts expose the globals required by app.js',
    run() {
      const routerScript = read('js/router.js');
      const authScript = read('js/auth.js');
      const appScript = read('js/app.js');

      assert.match(routerScript, /window\.CCRouter\s*=/);
      assert.match(authScript, /window\.CCAuth\s*=/);
      assert.match(appScript, /window\.CCRouter\.init\(\)/);
      assert.match(appScript, /window\.CCAuth\.isAuthenticated\(\)/);
    },
  },
];
