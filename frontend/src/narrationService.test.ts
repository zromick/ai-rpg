import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NARRATION_SERVICES, getNarrationService, DEFAULT_NARRATION_SERVICE_ID } from './narrationService'

global.fetch = vi.fn()

describe('NARRATION_SERVICES', () => {
  it('should be a non-empty array', () => {
    expect(NARRATION_SERVICES).toBeInstanceOf(Array)
    expect(NARRATION_SERVICES.length).toBeGreaterThan(0)
  })

  it('should contain services with required properties', () => {
    NARRATION_SERVICES.forEach(service => {
      expect(service).toHaveProperty('id')
      expect(service).toHaveProperty('name')
      expect(service).toHaveProperty('description')
      expect(service).toHaveProperty('voice')
      expect(service).toHaveProperty('fetchAudio')
      expect(typeof service.fetchAudio).toBe('function')
    })
  })

  it('should have unique ids', () => {
    const ids = NARRATION_SERVICES.map(s => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should include speecht5 service', () => {
    const speecht5 = NARRATION_SERVICES.find(s => s.id === 'speecht5')
    expect(speecht5).toBeDefined()
    expect(speecht5?.name).toBe('Microsoft SpeechT5')
    expect(speecht5?.description).toContain('Fast and reliable')
  })

  it('should include mms_tts_eng service', () => {
    const mms = NARRATION_SERVICES.find(s => s.id === 'mms_tts_eng')
    expect(mms).toBeDefined()
    expect(mms?.name).toBe('Meta MMS-TTS English')
  })

  it('should include bark_small service', () => {
    const bark = NARRATION_SERVICES.find(s => s.id === 'bark_small')
    expect(bark).toBeDefined()
    expect(bark?.name).toBe('Suno Bark Small')
  })

  it('should include espnet_vits service', () => {
    const espnet = NARRATION_SERVICES.find(s => s.id === 'espnet_vits')
    expect(espnet).toBeDefined()
    expect(espnet?.name).toBe('ESPnet VITS (LJSpeech)')
  })
})

describe('DEFAULT_NARRATION_SERVICE_ID', () => {
  it('should be defined', () => {
    expect(DEFAULT_NARRATION_SERVICE_ID).toBeDefined()
  })

  it('should match an existing service id', () => {
    const ids = NARRATION_SERVICES.map(s => s.id)
    expect(ids).toContain(DEFAULT_NARRATION_SERVICE_ID)
  })

  it('should be speecht5', () => {
    expect(DEFAULT_NARRATION_SERVICE_ID).toBe('speecht5')
  })
})

describe('getNarrationService', () => {
  it('should return service with matching id', () => {
    const service = getNarrationService('speecht5')
    expect(service.id).toBe('speecht5')
    expect(service.name).toBe('Microsoft SpeechT5')
  })

  it('should return first service for unknown id', () => {
    const service = getNarrationService('unknown-service')
    expect(service).toBe(NARRATION_SERVICES[0])
  })

  it('should return first service for empty string id', () => {
    const service = getNarrationService('')
    expect(service).toBe(NARRATION_SERVICES[0])
  })

  it('should return correct service for each known id', () => {
    const ids = ['speecht5', 'mms_tts_eng', 'bark_small', 'espnet_vits']
    
    ids.forEach(id => {
      const service = getNarrationService(id)
      expect(service.id).toBe(id)
    })
  })

  describe('fetchAudio', () => {
    beforeEach(() => {
      vi.resetAllMocks()
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:test-url'),
        revokeObjectURL: vi.fn(),
      })
    })

    it('should call fetch with correct endpoint', async () => {
      const mockBlob = new Blob(['audio'], { type: 'audio/wav' })
      const mockResponse = {
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      }
      
      global.fetch = vi.fn().mockResolvedValue(mockResponse as unknown as Response)

      const service = getNarrationService('speecht5')
      await service.fetchAudio('Test text')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ model: 'microsoft/speecht5_tts', text: 'Test text' }),
        })
      )
    })

    it('should throw error on 503 status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue('Model loading'),
      } as unknown as Response)

      const service = getNarrationService('speecht5')

      await expect(service.fetchAudio('Test')).rejects.toThrow('Model is loading')
    })

    it('should throw error on 401 status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Invalid key'),
      } as unknown as Response)

      const service = getNarrationService('speecht5')

      await expect(service.fetchAudio('Test')).rejects.toThrow('Invalid HF API key')
    })

    it('should return blob URL on success', async () => {
      const mockBlob = new Blob(['audio'], { type: 'audio/wav' })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      } as unknown as Response)

      const service = getNarrationService('speecht5')
      const result = await service.fetchAudio('Test')

      expect(result).toContain('blob:')
    })
  })
})
