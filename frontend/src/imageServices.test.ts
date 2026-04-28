import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IMAGE_SERVICES, getService, DEFAULT_SERVICE_ID } from './imageServices'

global.fetch = vi.fn()
global.URL = {
  createObjectURL: vi.fn(() => 'blob:test-url'),
  revokeObjectURL: vi.fn(),
} as any

const ALL_IDS = [
  'pollinations_default',
  'pollinations_dark_fantasy',
  'pollinations_painterly',
  'pollinations_anime',
  'pollinations_portrait',
  'pollinations_ink_sketch',
  'pollinations_widescreen',
] as const

describe('IMAGE_SERVICES', () => {
  it('should be a non-empty array', () => {
    expect(IMAGE_SERVICES).toBeInstanceOf(Array)
    expect(IMAGE_SERVICES.length).toBeGreaterThan(0)
  })

  it('should contain services with required properties', () => {
    IMAGE_SERVICES.forEach(service => {
      expect(service).toHaveProperty('id')
      expect(service).toHaveProperty('name')
      expect(service).toHaveProperty('description')
      expect(service).toHaveProperty('fetchImage')
      expect(typeof service.fetchImage).toBe('function')
    })
  })

  it('should have unique ids', () => {
    const ids = IMAGE_SERVICES.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(ALL_IDS)('should include %s service', (id) => {
    const svc = IMAGE_SERVICES.find(s => s.id === id)
    expect(svc).toBeDefined()
    expect(svc?.name.toLowerCase()).toContain('pollinations')
  })
})

describe('DEFAULT_SERVICE_ID', () => {
  it('should match an existing service id', () => {
    expect(IMAGE_SERVICES.map(s => s.id)).toContain(DEFAULT_SERVICE_ID)
  })

  it('should be pollinations_default', () => {
    expect(DEFAULT_SERVICE_ID).toBe('pollinations_default')
  })
})

describe('getService', () => {
  it('should return service with matching id', () => {
    const service = getService('pollinations_default')
    expect(service.id).toBe('pollinations_default')
  })

  it('should return first service for unknown id', () => {
    const service = getService('unknown-service')
    expect(service).toBe(IMAGE_SERVICES[0])
  })

  it('should return first service for empty string id', () => {
    const service = getService('')
    expect(service).toBe(IMAGE_SERVICES[0])
  })

  it('should return correct service for each known id', () => {
    ALL_IDS.forEach(id => {
      expect(getService(id).id).toBe(id)
    })
  })

  describe('fetchImage', () => {
    beforeEach(() => { vi.resetAllMocks() })

    it('should POST to /api/image with prompt + seed + dimensions', async () => {
      const mockBlob = new Blob(['image'], { type: 'image/png' })
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) } as unknown as Response)

      await getService('pollinations_default').fetchImage('A knight', 123)

      const [url, options] = (global.fetch as any).mock.calls[0]
      expect(url).toBe('/api/image')
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')
      const body = JSON.parse(options.body)
      expect(body.prompt).toContain('A knight')
      expect(body.seed).toBe(123)
      expect(body.width).toBe(768)
      expect(body.height).toBe(512)
    })

    it('should append style to prompt', async () => {
      const mockBlob = new Blob(['image'], { type: 'image/png' })
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) } as unknown as Response)

      await getService('pollinations_default').fetchImage('Dragon', 42)

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(body.prompt).toContain('Dragon')
      expect(body.prompt).toContain('medieval fantasy')
    })

    it('should throw error on failed response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false, status: 500, text: vi.fn().mockResolvedValue('boom'),
      } as unknown as Response)

      await expect(getService('pollinations_default').fetchImage('Test', 1))
        .rejects.toThrow('Image API error')
    })

    it('should return blob URL on success', async () => {
      const mockBlob = new Blob(['image'], { type: 'image/png' })
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) } as unknown as Response)
      ;(global.URL.createObjectURL as ReturnType<typeof vi.fn>).mockReturnValue('blob:mock-url')

      const result = await getService('pollinations_default').fetchImage('Test', 1)
      expect(result).toMatch(/^blob:/)
    })

    it('should use portrait dimensions for portrait service', async () => {
      const mockBlob = new Blob(['image'], { type: 'image/png' })
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) } as unknown as Response)

      await getService('pollinations_portrait').fetchImage('Face', 1)

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(body.width).toBe(512)
      expect(body.height).toBe(640)
    })

    it('should use widescreen dimensions for widescreen service', async () => {
      const mockBlob = new Blob(['image'], { type: 'image/png' })
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) } as unknown as Response)

      await getService('pollinations_widescreen').fetchImage('Landscape', 1)

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(body.width).toBe(1024)
      expect(body.height).toBe(512)
    })
  })
})
