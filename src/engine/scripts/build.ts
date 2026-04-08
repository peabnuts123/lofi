import { buildLibrary } from '@lofi/common/scripts/build';
import { copyFile, findFiles, joinPaths, makeDirectory, readFile, relativePath, writeFile } from '@lofi/common/scripts/util';

const SrcDirectory = 'src';

await buildLibrary({
  tsConfigPath: 'tsconfig.build.json',
  async postBuild(options) {
    /* Manually transform and emit shader files */
    console.log(`Compiling shader files... `);
    // const shaderFiles = await findFiles(/(\.vert$|\.frag$)/, SrcDirectory);
    const shaderFiles = await findFiles(/(\.glsl$)/, SrcDirectory);
    for (const shaderFile of shaderFiles) {
      const fileContents = await readFile(shaderFile);
      const newFileContents = `export default ${JSON.stringify(fileContents)}`;

      const outputFilePath = joinPaths(options.distDir, relativePath(SrcDirectory, `${shaderFile}.js`));
      const oututFileDir = joinPaths(outputFilePath, '..');

      await makeDirectory(oututFileDir);
      await writeFile(outputFilePath, newFileContents);
      const dtsFilePath = joinPaths(options.distDir, relativePath(SrcDirectory, `${shaderFile}.d.ts`));
      await copyFile(`${shaderFile}.d.ts`, dtsFilePath);
      console.log(`\tWrote shader '${outputFilePath}'.`);
    }
  },
});
