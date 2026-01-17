import { beforeAll, afterAll, beforeEach } from 'vitest'

beforeAll(async () => {
  console.log('Setting up test environment...')
})

beforeEach(async () => {
  // Will add database cleanup here when we have migrations
})

afterAll(async () => {
  console.log('Tearing down test environment...')
})
