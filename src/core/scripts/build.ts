import { buildLibrary } from '@lofi/common/scripts/build';

await buildLibrary({
  tsConfigPath: 'tsconfig.build.json',
});
