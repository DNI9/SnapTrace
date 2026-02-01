
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const args = process.argv.slice(2);
const releaseType = args[0];

if (!releaseType) {
  console.error('Please provide a release type (major, minor, patch) or a specific version.');
  process.exit(1);
}

const packageJsonPath = path.resolve(__dirname, '../package.json');
const manifestJsonPath = path.resolve(__dirname, '../manifest.json');

try {
  // Bump version using npm (updates package.json and package-lock.json)
  execSync(`npm version ${releaseType} --no-git-tag-version`, { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to bump version:', error.message);
  process.exit(1);
}

// Read the updated package.json to get the new version
const updatedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const newVersion = updatedPackageJson.version;

// Update manifest.json
const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
manifestJson.version = newVersion;
fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2) + '\n');
console.log('Updated manifest.json');

console.log(`\nVersion updated to ${newVersion}.`);
try {
  console.log('\nCommitting and tagging...');
  execSync('git add package.json package-lock.json manifest.json', { stdio: 'inherit' });
  execSync(`git commit -m "chore(release): v${newVersion}"`, { stdio: 'inherit' });
  execSync(`git tag v${newVersion}`, { stdio: 'inherit' });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('\nDo you want to push the tag? (y/N) ', (answer) => {
    if (answer.trim().toLowerCase() === 'y') {
      try {
        execSync('git push origin --tags', { stdio: 'inherit' });
      } catch (pushError) {
        console.error('Failed to push:', pushError.message);
      }
    } else {
      console.log('Push skipped.');
    }
    rl.close();
  });
} catch (error) {
  console.error('Git operations failed:', error.message);
  process.exit(1);
}
