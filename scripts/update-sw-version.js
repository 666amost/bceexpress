// File: scripts/update-sw-version.js

const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} PackageJson
 * @property {string} name
 * @property {string} version
 */

/**
 * @typedef {Object} UpdateResult
 * @property {boolean} success
 * @property {string} version
 * @property {string} [error]
 */

/**
 * Updates service worker version with current package version
 * @returns {UpdateResult} The update operation result
 */
function updateServiceWorkerVersion() {
  try {
    // Get version from package.json
    const pkgPath = path.join(__dirname, '../package.json');
    
    if (!fs.existsSync(pkgPath)) {
      throw new Error(`Package.json not found at: ${pkgPath}`);
    }

    /** @type {PackageJson} */
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const version = pkg.version;

    if (!version || typeof version !== 'string') {
      throw new Error('Invalid version in package.json');
    }

    // Path to sw.js
    const swPath = path.join(__dirname, '../public/sw.js');
    
    if (!fs.existsSync(swPath)) {
      throw new Error(`Service worker not found at: ${swPath}`);
    }

    // Read sw.js content
    let swCode = fs.readFileSync(swPath, 'utf8');

    // Replace CACHE_NAME line
    swCode = swCode.replace(
      /const CACHE_NAME = '.*?';/,
      `const CACHE_NAME = 'bce-express-v${version}';`
    );

    // Write updated sw.js
    fs.writeFileSync(swPath, swCode, 'utf8');

    return {
      success: true,
      version: `bce-express-v${version}`
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      version: '',
      error: errorMessage
    };
  }
}

// Execute the update operation
const result = updateServiceWorkerVersion();

if (result.success) {
  process.stdout.write(`✔ Service Worker updated with version: ${result.version}\n`);
  process.exit(0);
} else {
  process.stderr.write(`✖ Service Worker update failed: ${result.error || 'Unknown error'}\n`);
  process.exit(1);
}
