import { replaceTscAliasPaths } from 'tsc-alias';
import { rimraf } from 'rimraf';

import { pathExists, spawnAsync } from "./util";

export interface BuildOptions {
  packageJsonPath: string;
  tsConfigPath: string;
  /**
   * Path to directory into which project builds.
   */
  distDir: string;
  postBuild?: (options: BuildOptions) => Promise<void>;
}

export const DefaultOptions: BuildOptions = {
  packageJsonPath: 'package.json',
  tsConfigPath: 'tsconfig.json',
  distDir: 'dist',
};

export async function buildLibrary(options: Partial<BuildOptions>): Promise<void> {
  // Options
  const compiledOptions: BuildOptions = Object.assign({}, DefaultOptions, options);

  // Validation
  /* Validate script is being run from project root */
  const isInRoot = await pathExists(compiledOptions.packageJsonPath);
  if (!isInRoot) {
    console.error(`Could not find '${compiledOptions.packageJsonPath}'. Is this script being run from the project root?`);
    process.exit(1);
  }

  // Main
  /* Clean */
  console.log(`Cleaning build...`);
  await spawnAsync(`tsc --build ${compiledOptions.tsConfigPath} --clean`);
  await rimraf(compiledOptions.distDir);

  /* Compile */
  console.log(`Compiling project...`);
  await spawnAsync(`tsc --build ${compiledOptions.tsConfigPath}`);

  /* (Optional) Post-build steps */
  if (compiledOptions.postBuild) {
    await compiledOptions.postBuild(compiledOptions);
  }

  /* Rewrite import aliases */
  console.log(`Rewriting import aliases...`);
  await replaceTscAliasPaths({
    configFile: compiledOptions.tsConfigPath,
  });

  console.log(`Finished processing successfully.`);
}
