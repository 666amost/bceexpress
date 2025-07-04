// File: scripts/update-sw-version.js

const fs = require('fs');
const path = require('path');

// Ambil versi dari package.json
const pkg = require('../package.json');
const version = pkg.version;

// Path ke sw.js
const swPath = path.join(__dirname, '../public/sw.js');

// Baca isi file sw.js
let swCode = fs.readFileSync(swPath, 'utf8');

// Ganti baris CACHE_NAME
swCode = swCode.replace(
  /const CACHE_NAME = '.*?';/,
  `const CACHE_NAME = 'bce-express-v${version}';`
);

// Tulis ulang sw.js
fs.writeFileSync(swPath, swCode, 'utf8');

console.log(`✔ Service Worker updated with version: bce-express-v${version}`);
