import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IMAGE_SERVICES, getService, DEFAULT_SERVICE_ID } from './imageServices'

global.fetch = vi.fn()
global.URL = {
  createObjectURL: vi.fn(() => 'blob:test-url'),
  revokeObjectURL: vi.fn(),
} as any

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
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should include hf_flux_schnell service', () => {
    const flux = IMAGE_SERVICES.find(s => s.id === 'hf_flux_schnell')
    expect(flux).toBeDefined()
    expect(flux?.name).toBe('HF — FLUX.1 Schnell (fast)')
    expect(flux?.description).toContain('FLUX schnell')
  })

  it('should include hf_flux_dev service', () => {
    const dev = IMAGE_SERVICES.find(s => s.id === 'hf_flux_dev')
    expect(dev).toBeDefined()
    expect(dev?.name).toBe('HF — FLUX.1 Dev (quality)')
  })

  it('should include hf_dark_fantasy service', () => {
    const dark = IMAGE_SERVICES.find(s => s.id === 'hf_dark_fantasy')
    expect(dark).toBeDefined()
    expect(dark?.name).toBe('HF — Dark Fantasy')
  })

  it('should include hf_painterly service', () => {
    const painterly = IMAGE_SERVICES.find(s => s.id === 'hf_painterly')
    expect(painterly).toBeDefined()
    expect(painterly?.name).toBe('HF — Painterly')
  })

  it('should include hf_anime service', () => {
    const anime = IMAGE_SERVICES.find(s => s.id === 'hf_anime')
    expect(anime).toBeDefined()
    expect(anime?.name).toBe('HF — Anime')
  })

  it('should include hf_portrait service', () => {
    const portrait = IMAGE_SERVICES.find(s => s.id === 'hf_portrait')
    expect(portrait).toBeDefined()
    expect(portrait?.name).toBe('HF — Portrait Focus')
  })

  it('should include hf_ink_sketch service', () => {
    const ink = IMAGE_SERVICES.find(s => s.id === 'hf_ink_sketch')
    expect(ink).toBeDefined()
    expect(ink?.name).toBe('HF — Ink Sketch')
  })

  it('should include hf_widescreen service', () => {
    const widescreen = IMAGE_SERVICES.find(s => s.id === 'hf_widescreen')
    expect(widescreen).toBeDefined()
    expect(widescreen?.name).toBe('HF — Widescreen Scene')
  })
})

describe('DEFAULT_SERVICE_ID', () => {
  it('should be defined', () => {
    expect(DEFAULT_SERVICE_ID).toBeDefined()
  })

  it('should match an existing service id', () => {
    const ids = IMAGE_SERVICES.map(s => s.id)
    expect(ids).toContain(DEFAULT_SERVICE_ID)
  })

  it('should be hf_flux_schnell', () => {
    expect(DEFAULT_SERVICE_ID).toBe('hf_flux_schnell')
  })
})

describe('getService', () => {
  it('should return service with matching id', () => {
    const service = getService('hf_flux_schnell')
    expect(service.id).toBe('hf_flux_schnell')
    expect(service.name).toBe('HF — FLUX.1 Schnell (fast)')
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
    const ids = [
      'hf_flux_schnell',
      'hf_flux_dev',
      'hf_dark_fantasy',
      'hf_painterly',
      'hf_anime',
      'hf_portrait',
      'hf_ink_sketch',
      'hf_widescreen',
    ]

    ids.forEach(id => {
      const service = getService(id)
      expect(service.id).toBe(id)
    })
  })

  describe('fetchImage', () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })

    it('should call fetch with correct endpoint', async () => {
      const mockBlob = new Blob(['image'], { type: 'image/png' })
      const mockResponse = {
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse as unknown as Response)

      const service = getService('hf_flux_schnell')
      await service.fetchImage('A knight', 123)

      const [url, options] = (global.fetch as any).mock.calls[0]
      expect(url).toBe('/api/image')
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')
      const body = JSON.parse(options.body)
      expect(body.model).toBe('black-forest-labs/FLUX.1-schnell')
      expect(body.prompt).toContain('A knight')
      expect(body.seed).toBe(123)
      expect(body.width).toBe(768)
      expect(body.height).toBe(512)
      expect(body.num_inference_steps).toBe(4)
    })

    it('should append style to prompt', async () => {
      const mockBlob = new Blob(['image'], { type: 'image/png' })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      } as unknown as Response)

      const service = getService('hf_flux_schnell')
      await service.fetchImage('Dragon', 42)

      const [, options] = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.prompt).toContain('Dragon')
      expect(body.prompt).toContain('medieval fantasy')
    })

    it('should throw error on failed response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal error'),
      } as unknown as Response)

      const service = getService('hf_flux_schnell')

      await expect(service.fetchImage('Test', 1)).rejects.toThrow('HF API error')
    })

    it('should return blob URL on success', async () => {
      const mockBlob = new Blob(['image'], { type: 'image/png' })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      } as unknown as Response)
      ;(global.URL.createObjectURL as ReturnType<typeof vi.fn>).mockReturnValue('blob:mock-url')

      const service = getService('hf_flux_schnell')
      const result = await service.fetchImage('Test', 1)

      expect(result).toMatch(/^blob:/)
    })

    it('should use different dimensions for portrait service', async () => {
      const mockBlob = new Blob(['image'], { type: 'image/png' })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      } as unknown as Response)

      const service = getService('hf_portrait')
      await service.fetchImage('Face', 1)

      const [, options] = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.width).toBe(512)
      expect(body.height).toBe(640)
    })

    it('should use widescreen dimensions for widescreen service', async () => {
      const mockBlob = new Blob(['image'], { type: 'image/png' })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      } as unknown as Response)

      const service = getService('hf_widescreen')
      await service.fetchImage('Landscape', 1)

      const [, options] = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.width).toBe(1024)
      expect(body.height).toBe(512)
    })
  })
})