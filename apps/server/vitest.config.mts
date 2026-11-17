import { defineConfig } from 'vitest/config'

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@localhost:5432/canlipano_test'

export default defineConfig({
  test: {
    globalSetup: ['./tests/globalSetup.ts'],
    fileParallelism: false,
    env: { DATABASE_URL: TEST_DATABASE_URL, NODE_ENV: 'test' },
  },
})
