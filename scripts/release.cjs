
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const releaseType = args[0];

if (!releaseType) {
  console.error('Please provide a release type (major, minor, patch) or a specific version.');
  process.exit(1);
}

const packageJsonPath = path.resolve(__dirname, '../package.json');
const manifestJsonPath = path.resolve(__dirname, '../manifest.json');

const packageJson = require(packageJsonPath);
const manifestJson = require(manifestJsonPath);

const currentVersion = packageJson.version;
let newVersion;

if (['major', 'minor', 'patch'].includes(releaseType)) {
  const parts = currentVersion.split('.').map(Number);
  if (releaseType === 'major') {
    parts[0]++;
    parts[1] = 0;
    parts[2] = 0;
  } else if (releaseType === 'minor') {
    parts[1]++;
    parts[2] = 0;
  } else if (releaseType === 'patch') {
    parts[2]++;
  }
  newVersion = parts.join('.');
} else {
    // Basic validation for semantic versioning
    if (!/^\d+\.\d+\.\d+$/.test(releaseType)) {
        console.error('Invalid version format. Please use x.y.z');
        process.exit(1);
    }
  newVersion = releaseType;
}

console.log(`Bumping version from ${currentVersion} to ${newVersion}...`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('Updated package.json');

// Update manifest.json
manifestJson.version = newVersion;
// Manifest often doesn't need "version_name" but if it's there we could update it too. 
// For now, just strict version matching.
fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2) + '\n');
console.log('Updated manifest.json');

console.log(`\nVersion updated to ${newVersion}.`);
console.log(`To complete the release, you might want to run:`);
console.log(`  git add package.json manifest.json`);
console.log(`  git commit -m "chore(release): v${newVersion}"`);
console.log(`  git tag v${newVersion}`);
