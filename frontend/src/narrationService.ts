// src/narrationService.ts

export interface NarrationService {
  id: string
  name: string
  description: string
  voice: string
  fetchAudio: (text: string) => Promise<string>
}

const BRIDGE_API = '/api'

async function hfAudio(
  model: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${BRIDGE_API}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, text: payload.inputs }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')

    if (res.status === 503) {
      throw new Error('Model is loading. Try again in a few seconds.')
    }
    if (res.status === 401) {
      throw new Error('Invalid HF API key.')
    }
    throw new Error(`TTS error ${res.status}: ${err}`)
  }

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

// Only models actually deployed on the free HF Inference API.
// Parler-TTS, Kokoro, and Dia are NOT available serverless —
// they require dedicated inference endpoints (paid).

export const NARRATION_SERVICES: NarrationService[] = [
{
  id: 'speecht5',
  name: 'Microsoft SpeechT5',
  description: 'Fast and reliable. Best all-around for English narration.',
  voice: 'Neutral (LibriTTS)',
  fetchAudio: (text) =>
    hfAudio('microsoft/speecht5_tts', { inputs: text }),
},
{
  id: 'mms_tts_eng',
  name: 'Meta MMS-TTS English',
  description: "Meta's multilingual speech model. Clear and consistent.",
  voice: 'Neutral English',
  fetchAudio: (text) =>
    hfAudio('facebook/mms-tts-eng', { inputs: text }),
},
{
  id: 'bark_small',
  name: 'Suno Bark Small',
  description: 'Expressive and varied. Slower but more character in the voice.',
  voice: 'Expressive English',
  fetchAudio: (text) =>
    hfAudio('suno/bark-small', { inputs: text }),
},
{
  id: 'espnet_vits',
  name: 'ESPnet VITS (LJSpeech)',
  description: 'Lightweight VITS model. Fast, clear female voice.',
  voice: 'Female (LJSpeech)',
  fetchAudio: (text) =>
    hfAudio('espnet/kan-bayashi_ljspeech_vits', { inputs: text }),
},
]

export const DEFAULT_NARRATION_SERVICE_ID = 'speecht5'

export function getNarrationService(id: string): NarrationService {
return NARRATION_SERVICES.find(s => s.id === id) ?? NARRATION_SERVICES[0]
}
