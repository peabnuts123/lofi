import fs from 'node:fs/promises';
import path from 'node:path';

import { pathExists, spawnAsync, type PackageJsonType } from './util';

export interface PublishOptions {
  /**
   * Whether to actually publish to npm (false) or just do a "dry run" (true).
   */
  dryRun: boolean;
  /**
   * Path to package.json.
   */
  packageJsonPath: string;
  /**
   * Path to directory into which project builds.
   */
  distDir: string;
  /**
   * Fields to remove from package.json before publishing.
   */
  fieldsToRemoveFromPackageJson: Array<keyof PackageJsonType>;
  /**
   * Additional files to copy into the publish directory.
   */
  additionalFiles: string[];
}

export const DefaultOptions: PublishOptions = {
  dryRun: false,
  packageJsonPath: 'package.json',
  distDir: 'dist',
  fieldsToRemoveFromPackageJson: ['scripts', 'devDependencies'],
  additionalFiles: ['README.md'],
};

export async function publishLibrary(options?: Partial<PublishOptions>): Promise<void> {
  // Options
  const compiledOptions: PublishOptions = Object.assign({}, DefaultOptions, options);

  // Validation
  /* Validate script is being run from project root */
  const isInRoot = await pathExists(compiledOptions.packageJsonPath);
  if (!isInRoot) {
    console.error(`Could not find '${compiledOptions.packageJsonPath}'. Is this script being run from the project root?`);
    process.exit(1);
  }

  // Main
  /* Build project */
  console.log(`Building project...`);
  await spawnAsync('npm run build');

  /* Ensure compiled project exists in dist directory */
  const distDirExists = await pathExists(compiledOptions.distDir);
  if (!distDirExists) {
    console.error(`Could not find dist folder '${compiledOptions.distDir}'. Did the project compile properly?`);
    process.exit(2);
  }

  /* Copy additional files to publish */
  for (const fileToPublish of compiledOptions.additionalFiles) {
    console.log(`Copying file '${fileToPublish}'...`);
    await fs.copyFile(fileToPublish, path.join(compiledOptions.distDir, fileToPublish));
  }

  /* Read package.json */
  const packageJsonRaw = await fs.readFile(compiledOptions.packageJsonPath, 'utf-8');
  const PackageJson = JSON.parse(packageJsonRaw) as PackageJsonType;

  /* Remove development-only fields */
  console.log(`Removing fields from package.json: `, compiledOptions.fieldsToRemoveFromPackageJson);
  for (const fieldName of compiledOptions.fieldsToRemoveFromPackageJson) {
    delete PackageJson[fieldName];
  }

  /* Write modified package.json into dist directory */
  const publishedPackageJsonPath = path.join(compiledOptions.distDir, compiledOptions.packageJsonPath);
  await fs.writeFile(publishedPackageJsonPath, JSON.stringify(PackageJson, null, 2));

  /* Publish package */
  if (compiledOptions.dryRun) {
    console.log(`Dry run. Skipping publish to npm.`);
  } else {
    process.chdir(compiledOptions.distDir);

    /* Publish to npm (with tag `latest`) */
    console.log(`Publishing package '${PackageJson.name}@${PackageJson.version}'...`);
    await spawnAsync('npm publish --access public');
    console.log(`Successfully published package '${PackageJson.name}@${PackageJson.version}'.`);
  }

  console.log(`Finished processing successfully.`);
}
