import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

// CONFIG
/** Path to package.json. */
const PackageJsonPath = 'package.json';
const OutDir = 'dist';
const SrcDirectory = 'src';

// VALIDATION
// Validate script is being run from project root
const isInRoot = await pathExists(PackageJsonPath);
if (!isInRoot) {
  console.error(`Could not find '${PackageJsonPath}'. Is this script being run from the project root?`);
  process.exit(1);
}

// MAIN
/* Compile */
console.log(`Compiling project`);
await spawnAsync(`tsc --project tsconfig.build.json`);

/* Manually transform and emit shader files */
const shaderFiles = await findFiles(/(\.vert$|\.frag$)/, SrcDirectory);
for (const shaderFile of shaderFiles) {
  const fileContents = await fs.readFile(shaderFile, { encoding: 'utf-8' });
  const newFileContents = `export default ${JSON.stringify(fileContents)}`;

  const outputFilePath = path.resolve(OutDir, path.relative(SrcDirectory, `${shaderFile}.js`));
  const oututFileDir = path.resolve(outputFilePath, '..');
  console.log(`Writing shader file ${outputFilePath}...`);
  await fs.mkdir(oututFileDir, { recursive: true });
  await fs.writeFile(outputFilePath, newFileContents);
  const dtsFilePath = path.resolve(OutDir, path.relative(SrcDirectory, `${shaderFile}.d.ts`));
  await fs.copyFile(`${shaderFile}.d.ts`, dtsFilePath);
}

/* Rewrite import aliases */
console.log(`Rewriting import aliases`);
await spawnAsync(`tsc-alias -p tsconfig.json`);

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

async function findFiles(regex: RegExp, directory = '.'): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const matchedPaths: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      matchedPaths.push(...await findFiles(regex, entryPath));
    } else if (entry.isFile() && regex.test(entryPath)) {
      matchedPaths.push(entryPath);
    }
  }

  return matchedPaths;
}
