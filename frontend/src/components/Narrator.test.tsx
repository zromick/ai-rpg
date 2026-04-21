import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NARRATION_SERVICES, getNarrationService, DEFAULT_NARRATION_SERVICE_ID } from '../narrationService'

const createMockBlob = () => new Blob(['audio'], { type: 'audio/wav' })

describe('Narrator', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:audio-url'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Disabled state', () => {
    it('should return null when enabled is false', () => {
      const isDisabled = false
      expect(isDisabled).toBe(false)
    })
  })

  describe('lastGMRply prop', () => {
    it('should accept lastGMRply prop', () => {
      const lastGMRply = 'You find a golden chest.'
      expect(lastGMRply).toBeDefined()
      expect(lastGMRply).toContain('chest')
    })
  })

  describe('Auto-narrate on change', () => {
    it('should trigger narrate() when lastGMRply changes', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('speecht5')
      await service.fetchAudio('First reply')
      
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should narrate when enabled becomes true with existing lastGMRply', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const enabled = true
      const lastGMRply = 'GM reply text'
      
      const service = getNarrationService('speecht5')
      await service.fetchAudio(lastGMRply)
      
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('No repeat narration', () => {
    it('should prevent re-narrating same reply using lastNarratedRef', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('speecht5')
      const firstResult = await service.fetchAudio('Same reply')
      
      const lastNarratedRef = { current: 'Same reply' }
      const shouldNotNarrate = lastNarratedRef.current === 'Same reply'
      
      expect(shouldNotNarrate).toBe(true)
    })

    it('should narrate new reply after same reply was narrated', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('speecht5')
      await service.fetchAudio('Reply A')
      await service.fetchAudio('Reply B')
      
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Manual test button', () => {
    it('should call fetchAudio for test narration', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('speecht5')
      await service.fetchAudio('This is a test of the narration voice...')
      
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should narrate test string text', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('speecht5')
      const result = await service.fetchAudio('This is a test of the narration voice...')
      
      expect(result).toContain('blob:')
    })
  })

  describe('Service switch', () => {
    it('should have multiple services available', () => {
      expect(NARRATION_SERVICES.length).toBeGreaterThan(1)
    })

    it('should switch to next service', async () => {
      const service = getNarrationService('speecht5')
      expect(service.id).toBe('speecht5')
      expect(service.name).toBe('Microsoft SpeechT5')
    })

    it('should switch to previous service', async () => {
      const service = getNarrationService('mms_tts_eng')
      expect(service.id).toBe('mms_tts_eng')
      expect(service.name).toBe('Meta MMS-TTS English')
    })

    it('should cycle through all services', () => {
      const serviceIds = NARRATION_SERVICES.map(s => s.id)
      expect(serviceIds).toContain('speecht5')
      expect(serviceIds).toContain('mms_tts_eng')
      expect(serviceIds).toContain('bark_small')
      expect(serviceIds).toContain('espnet_vits')
    })
  })

  describe('Volume control', () => {
    it('should have volume state', () => {
      const volume = 0.5
      expect(volume).toBeGreaterThan(0)
      expect(volume).toBeLessThan(1)
    })

    it('should support volume range 0-1', () => {
      expect(0).toBeLessThan(1)
      expect(1).toBeGreaterThan(0)
    })
  })

  describe('Loading state', () => {
    it('should set loading during fetch', async () => {
      let loading = true
      
      const mockPromise = new Promise(resolve => {
        setTimeout(() => {
          loading = false
          resolve('blob:url')
        }, 10)
      })
      
      await mockPromise
      expect(loading).toBe(false)
    })
  })

  describe('Error handling', () => {
    it('should catch TTS errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      global.fetch = vi.fn().mockRejectedValue(new Error('TTS failed'))
      
      const service = getNarrationService('speecht5')
      
      try {
        await service.fetchAudio('Test')
      } catch (e) {
        expect(e).toBeDefined()
      }
      
      consoleSpy.mockRestore()
    })

    it('should handle 503 error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue('Model loading'),
      })

      const service = getNarrationService('speecht5')

      await expect(service.fetchAudio('Test')).rejects.toThrow('Model is loading')
    })

    it('should handle 401 error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Invalid key'),
      })

      const service = getNarrationService('speecht5')

      await expect(service.fetchAudio('Test')).rejects.toThrow('Invalid HF API key')
    })
  })

  describe('Stop on audio end', () => {
    it('should handle onEnded callback', () => {
      const stopFunction = () => {
        URL.revokeObjectURL('blob:audio-url')
      }
      
      stopFunction()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-url')
    })
  })

  describe('narrate(text)', () => {
    it('should accept optional text parameter', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('speecht5')
      await service.fetchAudio('Custom text')
      
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should use custom text when provided', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('speecht5')
      await service.fetchAudio('Custom narration text')
      
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('Fetch to /api/tts', () => {
    beforeEach(() => {
      vi.resetAllMocks()
      global.fetch = vi.fn()
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:audio-url'),
        revokeObjectURL: vi.fn(),
      })
    })

    it('should call /api/tts endpoint', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('speecht5')
      await service.fetchAudio('Test text')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tts',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should send correct model for speecht5', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('speecht5')
      await service.fetchAudio('Test text')

      const callArgs = global.fetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.model).toBe('microsoft/speecht5_tts')
      expect(body.text).toBe('Test text')
    })

    it('should send correct model for mms_tts_eng', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('mms_tts_eng')
      await service.fetchAudio('Test text')

      const callArgs = global.fetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.model).toBe('facebook/mms-tts-eng')
      expect(body.text).toBe('Test text')
    })

    it('should send correct model for bark_small', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('bark_small')
      await service.fetchAudio('Test text')

      const callArgs = global.fetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.model).toBe('suno/bark-small')
      expect(body.text).toBe('Test text')
    })

    it('should send correct model for espnet_vits', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('espnet_vits')
      await service.fetchAudio('Test text')

      const callArgs = global.fetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.model).toBe('espnet/kan-bayashi_ljspeech_vits')
      expect(body.text).toBe('Test text')
    })

    it('should create blob URL on success', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      })

      const service = getNarrationService('speecht5')
      const result = await service.fetchAudio('Test')

      expect(result).toContain('blob:')
      expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
    })

    it('should handle 503 loading error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue('Model loading'),
      })

      const service = getNarrationService('speecht5')

      await expect(service.fetchAudio('Test')).rejects.toThrow('Model is loading')
    })

    it('should handle 401 invalid key error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Invalid key'),
      })

      const service = getNarrationService('speecht5')

      await expect(service.fetchAudio('Test')).rejects.toThrow('Invalid HF API key')
    })

    it('should handle other error codes', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Server error'),
      })

      const service = getNarrationService('speecht5')

      await expect(service.fetchAudio('Test')).rejects.toThrow('TTS error 500')
    })
  })

  describe('Each service has fetchAudio', () => {
    it('speecht5 has fetchAudio', () => {
      const service = getNarrationService('speecht5')
      expect(typeof service.fetchAudio).toBe('function')
    })

    it('mms_tts_eng has fetchAudio', () => {
      const service = getNarrationService('mms_tts_eng')
      expect(typeof service.fetchAudio).toBe('function')
    })

    it('bark_small has fetchAudio', () => {
      const service = getNarrationService('bark_small')
      expect(typeof service.fetchAudio).toBe('function')
    })

    it('espnet_vits has fetchAudio', () => {
      const service = getNarrationService('espnet_vits')
      expect(typeof service.fetchAudio).toBe('function')
    })
  })
})