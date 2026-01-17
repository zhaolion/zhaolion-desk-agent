import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', 'src/**/*.d.ts'],
    },
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5433/desk_agent_test',
      REDIS_URL: 'redis://localhost:6380',
      JWT_SECRET: 'test-jwt-secret-for-testing-only',
      API_PORT: '3000',
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
