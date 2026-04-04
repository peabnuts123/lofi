import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    {
      name: 'inline-shaders',
      transform(code, id) {
        if (/\.vert$|\.frag$/.test(id)) {
          return `export default ${JSON.stringify(code)}`;
        }
      },
    },
  ],
  test: {
    environment: 'jsdom',
    expect: {
      requireAssertions: true,
    },
    reporters: ['verbose'],
  },
});
