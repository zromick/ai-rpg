import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  NARRATION_SERVICES,
  getNarrationService,
  DEFAULT_NARRATION_SERVICE_ID,
  isWebSpeechUrl,
  parseWebSpeechUrl,
} from './narrationService'

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
      expect(service).toHaveProperty('kind')
      expect(typeof service.fetchAudio).toBe('function')
    })
  })

  it('should have unique ids', () => {
    const ids = NARRATION_SERVICES.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should include at least one webspeech service', () => {
    expect(NARRATION_SERVICES.some(s => s.kind === 'webspeech')).toBe(true)
  })

  it('should include at least one remote (Pollinations) service', () => {
    expect(NARRATION_SERVICES.some(s => s.kind === 'remote')).toBe(true)
  })
})

describe('DEFAULT_NARRATION_SERVICE_ID', () => {
  it('should match an existing service id', () => {
    expect(NARRATION_SERVICES.map(s => s.id)).toContain(DEFAULT_NARRATION_SERVICE_ID)
  })

  it('should be a webspeech provider so a missing key never blocks the user', () => {
    const svc = getNarrationService(DEFAULT_NARRATION_SERVICE_ID)
    expect(svc.kind).toBe('webspeech')
  })
})

describe('getNarrationService', () => {
  it('should return service with matching id', () => {
    const service = getNarrationService('webspeech_default')
    expect(service.id).toBe('webspeech_default')
  })

  it('should return first service for unknown id', () => {
    const service = getNarrationService('unknown-service')
    expect(service).toBe(NARRATION_SERVICES[0])
  })

  it('should return first service for empty string id', () => {
    const service = getNarrationService('')
    expect(service).toBe(NARRATION_SERVICES[0])
  })

  describe('Web Speech provider', () => {
    it('returns a speechSynthesis:// sentinel URL with rate + pitch', async () => {
      const url = await getNarrationService('webspeech_default').fetchAudio('hello')
      expect(isWebSpeechUrl(url)).toBe(true)
      const parsed = parseWebSpeechUrl(url)
      expect(parsed.voice).toBe('default')
      expect(parsed.rate).toBe(1)
      expect(parsed.pitch).toBe(1)
    })

    it('low-voice variant has reduced pitch', async () => {
      const url = await getNarrationService('webspeech_low').fetchAudio('hello')
      const parsed = parseWebSpeechUrl(url)
      expect(parsed.pitch).toBeLessThan(1)
    })

    it('fast-reader variant has increased rate', async () => {
      const url = await getNarrationService('webspeech_fast').fetchAudio('hello')
      const parsed = parseWebSpeechUrl(url)
      expect(parsed.rate).toBeGreaterThan(1)
    })

    it('does not call fetch (network)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
      await getNarrationService('webspeech_default').fetchAudio('hello')
      expect(fetchSpy).not.toHaveBeenCalled()
      fetchSpy.mockRestore()
    })
  })

  describe('Pollinations remote provider', () => {
    beforeEach(() => {
      vi.resetAllMocks()
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:remote-url'),
        revokeObjectURL: vi.fn(),
      })
    })

    it('POSTs to /api/tts with the chosen voice + text', async () => {
      const mockBlob = new Blob(['audio'], { type: 'audio/mpeg' })
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) } as unknown as Response)

      await getNarrationService('pollinations_alloy').fetchAudio('Test text')

      const call = (global.fetch as any).mock.calls[0]
      expect(call[0]).toBe('/api/tts')
      expect(call[1].method).toBe('POST')
      const body = JSON.parse(call[1].body)
      expect(body.voice).toBe('alloy')
      expect(body.text).toBe('Test text')
    })

    it('returns a blob URL on success', async () => {
      const mockBlob = new Blob(['audio'], { type: 'audio/mpeg' })
      global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(mockBlob) } as unknown as Response)

      const url = await getNarrationService('pollinations_alloy').fetchAudio('hi')
      expect(url).toContain('blob:')
    })

    it('rejects on non-OK response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false, status: 500, text: vi.fn().mockResolvedValue('boom'),
      } as unknown as Response)

      await expect(getNarrationService('pollinations_alloy').fetchAudio('hi'))
        .rejects.toThrow('TTS error 500')
    })
  })
})

describe('isWebSpeechUrl / parseWebSpeechUrl', () => {
  it('detects sentinel URLs', () => {
    expect(isWebSpeechUrl('speechSynthesis://default?rate=1&pitch=1')).toBe(true)
    expect(isWebSpeechUrl('blob:abc')).toBe(false)
    expect(isWebSpeechUrl('')).toBe(false)
  })

  it('parses rate, pitch, and voice', () => {
    const parsed = parseWebSpeechUrl('speechSynthesis://my%20voice?rate=1.25&pitch=0.7')
    expect(parsed.voice).toBe('my voice')
    expect(parsed.rate).toBe(1.25)
    expect(parsed.pitch).toBe(0.7)
  })
})
