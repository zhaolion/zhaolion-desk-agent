import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'apps/api',
  'apps/worker',
  'packages/domain',
  'packages/shared',
])
