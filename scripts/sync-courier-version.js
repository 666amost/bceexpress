// File: scripts/sync-courier-version.js

const fs = require('fs');
const path = require('path');

/**
 * Synchronizes BCE-KURIR version with main app version
 */
function syncCourierVersion() {
  try {
    // If the BCE-KURIR package is not present in the repo (it's often gitignored),
    // skip the sync step instead of failing the build.
    const courierDir = path.join(__dirname, '../BCE-KURIR');
    if (!fs.existsSync(courierDir)) {
      process.stdout.write('ℹ BCE-KURIR not present in repository; skipping courier version sync.\n');
      return {
        success: true,
        version: ''
      };
    }
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
      // If package.json is missing inside the BCE-KURIR folder, skip rather than failing.
      process.stdout.write(`ℹ BCE-KURIR package.json not found at: ${courierPkgPath}; skipping courier sync.\n`);
      return {
        success: true,
        version: ''
      };
    }

    const courierPkg = JSON.parse(fs.readFileSync(courierPkgPath, 'utf8'));
    courierPkg.version = mainVersion;
    fs.writeFileSync(courierPkgPath, JSON.stringify(courierPkg, null, 2), 'utf8');

    // Service worker disabled - skip sw.js updates
    process.stdout.write(`ℹ Service worker disabled - package.json updated only.\n`);

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
