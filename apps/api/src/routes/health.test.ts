import { describe, it, expect } from 'vitest'
import { healthRoutes } from './health.js'
import { Hono } from 'hono'

describe('Health Routes', () => {
  const app = new Hono()
  app.route('/', healthRoutes)

  describe('GET /health', () => {
    it('should return ok status', async () => {
      const res = await app.request('/health')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty('status', 'ok')
    })
  })
})
