import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

import PackageJson from '../package.json' with { type: 'json' };

// CONFIG
/** Whether to actually publish to npm (false) or just do a "dry run" (true). */
const DryRun = false;
/** Path to package.json. */
const PackageJsonPath = 'package.json';
/** Path to directory into which project builds. */
const DistDir = 'dist/';
/**
 * Fields to remove from package.json before publishing.
 */
const FieldsToRemoveFromPackageJson: Array<keyof typeof PackageJson> = ['scripts', 'devDependencies'];
/**
 * Additional files to copy into the publish directory
 */
const FilesToPublish = [
  'README.md',
];

// VALIDATION
// Validate script is being run from project root
const isInRoot = await pathExists(PackageJsonPath);
if (!isInRoot) {
  console.error(`Could not find '${PackageJsonPath}'. Is this script being run from the project root?`);
  process.exit(1);
}

// MAIN
// Build project
console.log(`Building project...`);
await spawnAsync('npm run build');


// Ensure compiled project exists in dist directory
const distDirExists = await pathExists(DistDir);
if (!distDirExists) {
  console.error(`Could not find dist folder '${DistDir}'. Did the project compile properly?`);
  process.exit(2);
}

// Copy additional files to publish
for (const fileToPublish of FilesToPublish) {
  console.log(`Copying file '${fileToPublish}'...`);
  await fs.copyFile(fileToPublish, path.join(DistDir, fileToPublish));
}

// Remove development-only fields
console.log(`Removing fields from package.json: `, FieldsToRemoveFromPackageJson);
FieldsToRemoveFromPackageJson.forEach((fieldName) => {
  delete PackageJson[fieldName];
});

// Write modified package.json into dist directory
const publishedPackageJsonPath = path.join(DistDir, PackageJsonPath);
await fs.writeFile(publishedPackageJsonPath, JSON.stringify(PackageJson, null, 2));

// Publish package
if (DryRun) {
  console.log(`Dry run. Skipping publish to npm.`);
} else {
  process.chdir(DistDir);

  // Publish to npm (with tag `latest`)
  console.log(`Publishing package '${PackageJson.name}@${PackageJson.version}'`);
  await spawnAsync('npm publish --access public');
  console.log(`Successfully published package '${PackageJson.name}@${PackageJson.version}'`);
}

console.log(`Finished processing successfully.`);

// FUNCTIONS
async function spawnAsync(command: string): Promise<void> {
  const [cmd, ...args] = command.split(/\s+/g);
  const npmProcess = spawn(cmd, args, { stdio: 'inherit' });
  await new Promise<void>((resolve, reject) => {
    npmProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`command exited with code ${code}`));
      }
    });
  });
}

function pathExists(path: string): Promise<boolean> {
  return fs.access(path, fs.constants.R_OK)
    .then(() => true)
    .catch(() => false);
}
