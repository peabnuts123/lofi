import { defineConfig } from 'vitest/config';
import type { PluginOption } from 'vite';

function inlineShadersPlugin(): PluginOption {
  return {
    name: 'inline-shaders',
    transform(code, id) {
      if (/\.vert$|\.frag$/.test(id)) {
        return `export default ${JSON.stringify(code)}`;
      }
    },
  };
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    inlineShadersPlugin(),
  ],
  test: {
    environment: 'jsdom',
    expect: {
      requireAssertions: true,
    },
    reporters: ['verbose'],
  },
});
