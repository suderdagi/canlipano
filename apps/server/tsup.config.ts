import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  // The shared package is TypeScript source, so it is bundled into the server build
  noExternal: ['@canlipano/shared'],
})
