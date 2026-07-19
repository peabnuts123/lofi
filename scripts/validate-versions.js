const { execSync, spawnSync } = require('node:child_process')

// Parse package.json files
const PackageCore = require('../src/core/package.json');
const PackageEngine = require('../src/engine/package.json');

// Ensure versions match
if (PackageCore.version !== PackageEngine.version) {
  throw new Error(`Package versions do not match: (${PackageCore.name}='${PackageCore.version}') (${PackageEngine.name}='${PackageEngine.version}')`);
} else {
  console.log(`Package versions match: ${PackageCore.version}`);
}

// Validate target version doesn't exist on npm
validatePackageVersionDoesNotExist(PackageCore.name, PackageCore.version);
validatePackageVersionDoesNotExist(PackageEngine.name, PackageEngine.version);


// FUNCTIONS
/**
 * Ensure a package exists on npm, but not at the specified version.
 * @param {string} packageName
 * @param {string} packageVersion
 */
function validatePackageVersionDoesNotExist(packageName, packageVersion) {
  // Validate package exists (any version)
  let json = queryNpm(packageName);
  if (typeof json === 'string') {
    console.log(`Package '${packageName}' exists on npm`);
  } else if (typeof json === 'object' && json.error?.code === 'E404') {
    throw new Error(`Package '${packageName}' does not exist on npm`);
  } else {
    throw new Error(`Unexpected error checking whether package '${packageName}' exists on npm: ${JSON.stringify(json.error, null, 2)}`);
  }

  // Validate specified version does not exist
  const versionedSlug = `${packageName}@${packageVersion}`;
  json = queryNpm(versionedSlug);
  if (json.error === undefined) {
    // Successfully retrieved specified version (failure)
    throw new Error(`Package version '${versionedSlug}' already exists on npm`)
  } else if (json.error.code !== 'E404') {
    // Another error occurred (failure)
    throw new Error(`Unexpected error resolving package '${versionedSlug}' on npm: ${JSON.stringify(json.error, null, 2)}`);
  } else {
    // Got specifically a 404 (success)
    console.log(`Package version '${versionedSlug}' does not exist on npm`);
  }
}

/**
 * Query npm for a specified package slug
 * @param {string} slug npm package slug e.g. `lodash` or `lodash@4.18.1`
 * @returns Parsed JSON output from npm (a string for a successful lookup, or an object for a failure)
 */
function queryNpm(slug) {
  const result = spawnSync(`npm`, [
    `info`,
    `--json`,
    slug,
    `version`,
  ], { encoding: 'utf-8' });

  return tryParseJSON(result.stdout, (e) => `Failed to parse npm output JSON: ${e}`);
}

/**
 * Parse a JSON string, or throw a specific error message if JSON parsing fails.
 * @param {string} str JSON string to parse.
 * @param {(e: any) => string} errorFn Function to transform the caught error into a new error message.
 * @returns {any}
 */
function tryParseJSON(str, errorFn) {
  try {
    return JSON.parse(str);
  } catch (e) {
    throw new Error(errorFn(e));
  }
}