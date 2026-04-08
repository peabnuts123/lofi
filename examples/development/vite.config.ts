import { defineConfig, type PluginOption } from 'vite';
import tailwindcss from '@tailwindcss/vite';

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
    tailwindcss(),
    inlineShadersPlugin(), // @NOTE This is only needed because the source is in the same repo.
  ],
});
