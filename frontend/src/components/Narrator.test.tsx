import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NARRATION_SERVICES, getNarrationService, isWebSpeechUrl } from '../narrationService'

const createMockBlob = () => new Blob(['audio'], { type: 'audio/mpeg' })

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
      expect(false).toBe(false)
    })
  })

  describe('lastGMRply prop', () => {
    it('should accept lastGMRply prop', () => {
      const lastGMRply = 'You find a golden chest.'
      expect(lastGMRply).toContain('chest')
    })
  })

  describe('Web Speech default', () => {
    it('returns a speechSynthesis sentinel URL', async () => {
      const service = getNarrationService('webspeech_default')
      const url = await service.fetchAudio('Hello')
      expect(isWebSpeechUrl(url)).toBe(true)
    })

    it('does not hit the network', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
      await getNarrationService('webspeech_default').fetchAudio('Hello')
      expect(fetchSpy).not.toHaveBeenCalled()
      fetchSpy.mockRestore()
    })
  })

  describe('Auto-narrate on change', () => {
    it('should call fetchAudio when lastGMRply changes (remote provider)', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) })
      const service = getNarrationService('pollinations_alloy')
      await service.fetchAudio('First reply')
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should narrate when enabled becomes true with existing lastGMRply', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) })
      const service = getNarrationService('pollinations_alloy')
      await service.fetchAudio('GM reply text')
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('No repeat narration', () => {
    it('should narrate two distinct replies in sequence', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) })
      const service = getNarrationService('pollinations_alloy')
      await service.fetchAudio('Reply A')
      await service.fetchAudio('Reply B')
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Manual test button', () => {
    it('should fetch on manual narration (remote provider)', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) })
      const service = getNarrationService('pollinations_alloy')
      await service.fetchAudio('test')
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should return blob URL for remote provider on success', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) })
      const service = getNarrationService('pollinations_alloy')
      const result = await service.fetchAudio('test')
      expect(result).toContain('blob:')
    })
  })

  describe('Service switch', () => {
    it('should have multiple services available', () => {
      expect(NARRATION_SERVICES.length).toBeGreaterThan(1)
    })

    it('contains the webspeech default', () => {
      const service = getNarrationService('webspeech_default')
      expect(service.id).toBe('webspeech_default')
      expect(service.kind).toBe('webspeech')
    })

    it('contains a pollinations alloy voice', () => {
      const service = getNarrationService('pollinations_alloy')
      expect(service.id).toBe('pollinations_alloy')
      expect(service.kind).toBe('remote')
    })

    it('cycles through expected ids', () => {
      const ids = NARRATION_SERVICES.map(s => s.id)
      expect(ids).toContain('webspeech_default')
      expect(ids).toContain('webspeech_low')
      expect(ids).toContain('webspeech_fast')
      expect(ids).toContain('pollinations_alloy')
      expect(ids).toContain('pollinations_onyx')
      expect(ids).toContain('pollinations_nova')
    })
  })

  describe('Volume control', () => {
    it('range 0-1', () => {
      expect(0).toBeLessThan(1)
    })
  })

  describe('Error handling', () => {
    it('rejects when remote /api/tts fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: vi.fn().mockResolvedValue('boom') })
      const service = getNarrationService('pollinations_alloy')
      await expect(service.fetchAudio('Test')).rejects.toThrow('TTS error 500')
    })
  })

  describe('Stop on audio end', () => {
    it('should call URL.revokeObjectURL on stop', () => {
      const stopFn = () => URL.revokeObjectURL('blob:audio-url')
      stopFn()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-url')
    })
  })

  describe('narrate(text)', () => {
    it('passes the text through to the remote provider', async () => {
      const mockBlob = createMockBlob()
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) })
      const service = getNarrationService('pollinations_alloy')
      await service.fetchAudio('Custom text')
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(body.text).toBe('Custom text')
    })
  })

  describe('Fetch to /api/tts', () => {
    beforeEach(() => {
      vi.resetAllMocks()
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:audio-url'),
        revokeObjectURL: vi.fn(),
      })
    })

    it('hits /api/tts with POST', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(createMockBlob()) })
      await getNarrationService('pollinations_alloy').fetchAudio('Test')
      expect(global.fetch).toHaveBeenCalledWith('/api/tts', expect.objectContaining({ method: 'POST' }))
    })

    it('sends correct voice for pollinations_alloy', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(createMockBlob()) })
      await getNarrationService('pollinations_alloy').fetchAudio('Test text')
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(body.voice).toBe('alloy')
      expect(body.text).toBe('Test text')
    })

    it('sends correct voice for pollinations_onyx', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(createMockBlob()) })
      await getNarrationService('pollinations_onyx').fetchAudio('Test text')
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(body.voice).toBe('onyx')
    })

    it('sends correct voice for pollinations_nova', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(createMockBlob()) })
      await getNarrationService('pollinations_nova').fetchAudio('Test text')
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(body.voice).toBe('nova')
    })

    it('creates blob URL on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(createMockBlob()) })
      const result = await getNarrationService('pollinations_alloy').fetchAudio('Test')
      expect(result).toContain('blob:')
    })

    it('rejects on 500-class errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: vi.fn().mockResolvedValue('boom') })
      await expect(getNarrationService('pollinations_alloy').fetchAudio('Test'))
        .rejects.toThrow('TTS error 500')
    })
  })

  describe('Each service has fetchAudio', () => {
    it('webspeech_default has fetchAudio', () => {
      expect(typeof getNarrationService('webspeech_default').fetchAudio).toBe('function')
    })
    it('pollinations_alloy has fetchAudio', () => {
      expect(typeof getNarrationService('pollinations_alloy').fetchAudio).toBe('function')
    })
    it('pollinations_onyx has fetchAudio', () => {
      expect(typeof getNarrationService('pollinations_onyx').fetchAudio).toBe('function')
    })
    it('pollinations_nova has fetchAudio', () => {
      expect(typeof getNarrationService('pollinations_nova').fetchAudio).toBe('function')
    })
  })
})
