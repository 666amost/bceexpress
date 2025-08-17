// File: scripts/sync-courier-version.js

const fs = require('fs');
const path = require('path');

/**
 * Synchronizes BCE-KURIR version with main app version
 */
function syncCourierVersion() {
  try {
    // Get version from main package.json
    const mainPkgPath = path.join(__dirname, '../package.json');
    const mainPkg = JSON.parse(fs.readFileSync(mainPkgPath, 'utf8'));
    const mainVersion = mainPkg.version;

    if (!mainVersion || typeof mainVersion !== 'string') {
      throw new Error('Invalid version in main package.json');
    }

    // Update BCE-KURIR package.json
    const courierPkgPath = path.join(__dirname, '../BCE-KURIR/package.json');
    
    if (!fs.existsSync(courierPkgPath)) {
      throw new Error(`BCE-KURIR package.json not found at: ${courierPkgPath}`);
    }

    const courierPkg = JSON.parse(fs.readFileSync(courierPkgPath, 'utf8'));
    courierPkg.version = mainVersion;
    fs.writeFileSync(courierPkgPath, JSON.stringify(courierPkg, null, 2), 'utf8');

    // Update BCE-KURIR sw.js
    const courierSwPath = path.join(__dirname, '../BCE-KURIR/sw.js');
    
    if (!fs.existsSync(courierSwPath)) {
      throw new Error(`BCE-KURIR sw.js not found at: ${courierSwPath}`);
    }

    let courierSwCode = fs.readFileSync(courierSwPath, 'utf8');

    // Update cache names with new version
    const cacheUpdates = [
      [/const CACHE_NAME = '.*?';/, `const CACHE_NAME = 'bce-kurir-v${mainVersion}';`],
      [/const CRITICAL_CACHE = '.*?';/, `const CRITICAL_CACHE = 'bce-kurir-critical-v${mainVersion}';`],
      [/const API_CACHE = '.*?';/, `const API_CACHE = 'bce-kurir-api-v${mainVersion}';`],
      [/const IMAGE_CACHE = '.*?';/, `const IMAGE_CACHE = 'bce-kurir-images-v${mainVersion}';`]
    ];

    for (const [pattern, replacement] of cacheUpdates) {
      courierSwCode = courierSwCode.replace(pattern, replacement);
    }

    fs.writeFileSync(courierSwPath, courierSwCode, 'utf8');

    return {
      success: true,
      version: mainVersion
    };

  } catch (error) {
    return {
      success: false,
      version: '',
      error: error.message || 'Unknown error occurred'
    };
  }
}

// Execute the sync operation
const result = syncCourierVersion();

if (result.success) {
  process.stdout.write(`✔ BCE-KURIR synced with main app version: ${result.version}\n`);
  process.exit(0);
} else {
  process.stderr.write(`✖ Sync failed: ${result.error || 'Unknown error'}\n`);
  process.exit(1);
}
