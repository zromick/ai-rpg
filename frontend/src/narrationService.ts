// src/narrationService.ts
//
// Narration providers. The HuggingFace TTS endpoints we used to depend on no
// longer reliably serve under the free Inference API, so the default provider
// is now the browser's own Web Speech synthesis. A second provider hits the
// free Pollinations.ai TTS endpoint for higher quality.
//
// The interface is async and returns a string. For Web Speech, the string is
// a sentinel ("speechSynthesis://<voiceName>?rate=&pitch=") that the Narrator
// component recognises and plays via window.speechSynthesis instead of <audio>.
// For Pollinations, it's a real audio URL.

export interface NarrationService {
  id: string
  name: string
  description: string
  voice: string
  /** Local sentinel scheme for browser-native voices; null for fully remote audio */
  kind: 'webspeech' | 'remote'
  fetchAudio: (text: string) => Promise<string>
}

const BRIDGE_API = '/api'
const SPEECH_PREFIX = 'speechSynthesis://'

function webSpeech(voice: string, rate = 1.0, pitch = 1.0): (text: string) => Promise<string> {
  return async (_text: string) => {
    const params = new URLSearchParams({ rate: String(rate), pitch: String(pitch) })
    return `${SPEECH_PREFIX}${encodeURIComponent(voice)}?${params.toString()}`
  }
}

async function pollinationsTTS(voice: string, text: string): Promise<string> {
  const res = await fetch(`${BRIDGE_API}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice, text }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(`TTS error ${res.status}: ${err}`)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export const NARRATION_SERVICES: NarrationService[] = [
  {
    id: 'webspeech_default',
    name: 'Browser — Default',
    description: 'Your browser\'s built-in voice. Instant, free, no network.',
    voice: 'default',
    kind: 'webspeech',
    fetchAudio: webSpeech('default', 1.0, 1.0),
  },
  {
    id: 'webspeech_low',
    name: 'Browser — Low Voice',
    description: 'Built-in voice, deeper pitch.',
    voice: 'default',
    kind: 'webspeech',
    fetchAudio: webSpeech('default', 0.95, 0.7),
  },
  {
    id: 'webspeech_fast',
    name: 'Browser — Fast Reader',
    description: 'Built-in voice, faster pace.',
    voice: 'default',
    kind: 'webspeech',
    fetchAudio: webSpeech('default', 1.25, 1.0),
  },
  {
    id: 'pollinations_alloy',
    name: 'Pollinations — Alloy',
    description: 'OpenAI-quality voice via Pollinations. Smooth, neutral.',
    voice: 'alloy',
    kind: 'remote',
    fetchAudio: (text) => pollinationsTTS('alloy', text),
  },
  {
    id: 'pollinations_onyx',
    name: 'Pollinations — Onyx',
    description: 'Deep narrator voice via Pollinations.',
    voice: 'onyx',
    kind: 'remote',
    fetchAudio: (text) => pollinationsTTS('onyx', text),
  },
  {
    id: 'pollinations_nova',
    name: 'Pollinations — Nova',
    description: 'Bright, expressive voice via Pollinations.',
    voice: 'nova',
    kind: 'remote',
    fetchAudio: (text) => pollinationsTTS('nova', text),
  },
]

export const DEFAULT_NARRATION_SERVICE_ID = 'webspeech_default'

export function getNarrationService(id: string): NarrationService {
  return NARRATION_SERVICES.find(s => s.id === id) ?? NARRATION_SERVICES[0]
}

export function isWebSpeechUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith(SPEECH_PREFIX)
}

export function parseWebSpeechUrl(url: string): { voice: string; rate: number; pitch: number } {
  const without = url.slice(SPEECH_PREFIX.length)
  const [voicePart, query = ''] = without.split('?')
  const params = new URLSearchParams(query)
  return {
    voice: decodeURIComponent(voicePart),
    rate: parseFloat(params.get('rate') || '1.0'),
    pitch: parseFloat(params.get('pitch') || '1.0'),
  }
}
