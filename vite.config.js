import { defineConfig } from 'vite'
import viteCompression from 'vite-plugin-compression'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  assetsInclude: ['src/assets/**/*'],
  base: '',
  build: {
    outDir: 'docs',
    minify: 'terser',
  },
  plugins: [
    topLevelAwait(),
    viteStaticCopy({
      targets: [
        {
          src: 'src/assets/sponza/*.{jpg,webp,png,bin,gz}',
          dest: 'assets',
        },
      ],
    }),
    viteCompression(),
  ],
  server: {
    host: true,
    // https: true,
  },
})
