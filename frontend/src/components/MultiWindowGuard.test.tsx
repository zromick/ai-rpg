import { describe, it, expect } from 'vitest'

describe('MultiWindowGuard', () => {
  it('should export MultiWindowGuard component', async () => {
    const module = await import('./MultiWindowGuard')
    expect(module.MultiWindowGuard).toBeDefined()
  })
})