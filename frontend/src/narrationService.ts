// src/narrationServices.ts
// Hugging Face Inference API — Text-to-Speech
// Same pattern as imageServices: POST → binary blob → object URL
// Token read from VITE_HF_API_KEY (same env var as image services)

export interface NarrationService {
  id: string
  name: string
  description: string
  voice: string          // human-readable voice/style label
  fetchAudio: (text: string) => Promise<string>  // returns object URL
}

const HF_API = 'https://router.huggingface.co/hf-inference/models'
const TOKEN = import.meta.env.VITE_HF_API_KEY ?? ''

async function hfAudio(
  model: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`${HF_API}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`HF TTS error ${response.status}: ${err}`)
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

export const NARRATION_SERVICES: NarrationService[] = [
  {
    id: 'speecht5',
    name: 'Microsoft SpeechT5',
    description: 'Fast, reliable, neutral English voice. Best for long narration.',
    voice: 'Neutral male (LibriTTS)',
    fetchAudio: (text) =>
      hfAudio('microsoft/speecht5_tts', { inputs: text }),
  },
  {
    id: 'parler_mini',
    name: 'Parler-TTS Mini',
    description: 'Expressive, high-quality. Supports natural language voice descriptions.',
    voice: 'Expressive female, clear audio',
    fetchAudio: (text) =>
      hfAudio('parler-tts/parler-tts-mini-v1', {
        inputs: text,
        parameters: {
          description:
            'A deep, dramatic male narrator speaks slowly and clearly with a cinematic tone. The recording is of very high quality, with very clear audio.',
        },
      }),
  },
  {
    id: 'kokoro',
    name: 'Kokoro 82M',
    description: 'Tiny but surprisingly high quality. Very fast inference.',
    voice: 'American female (af_heart)',
    fetchAudio: (text) =>
      hfAudio('hexgrad/Kokoro-82M', {
        inputs: text,
        parameters: { voice: 'af_heart' },
      }),
  },
  {
    id: 'mms_tts',
    name: 'Facebook MMS-TTS',
    description: "Meta's Massively Multilingual Speech model. Solid English narrator.",
    voice: 'Neutral English (eng)',
    fetchAudio: (text) =>
      hfAudio('facebook/mms-tts-eng', { inputs: text }),
  },
  {
    id: 'dia_1b',
    name: 'Nari Labs Dia 1.6B',
    description: 'Large, highly realistic. Best overall quality, slowest to generate.',
    voice: 'Cinematic narrator',
    fetchAudio: (text) =>
      hfAudio('nari-labs/Dia-1.6B', { inputs: text }),
  },
]

export const DEFAULT_NARRATION_SERVICE_ID = 'speecht5'

export function getNarrationService(id: string): NarrationService {
  return NARRATION_SERVICES.find(s => s.id === id) ?? NARRATION_SERVICES[0]
}
