// src/imageServices.ts
//
// Image generation via Pollinations.ai — free, no auth, no API key.
// Endpoint: https://image.pollinations.ai/prompt/{encoded prompt}?seed=...&width=...&height=...&nologo=true&private=true
// We still proxy through the local /api/image bridge so CORS / failure handling
// is consistent with the rest of the app.

import type { ImageService } from './types'

const BRIDGE_API = '/api'

const STYLE =
  'medieval fantasy, dramatic lighting, painterly, cinematic composition, detailed, no text, no watermark, no UI'

async function pollinationsImage(
  prompt: string,
  seed: number,
  width = 768,
  height = 512,
): Promise<string> {
  const response = await fetch(`${BRIDGE_API}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, seed, width, height }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error')
    throw new Error(`Image API error: ${err}`)
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

export const IMAGE_SERVICES: ImageService[] = [
  {
    id: 'pollinations_default',
    name: 'Pollinations — Default',
    description: 'Pollinations.ai default model. Fast and reliable, no API key.',
    fetchImage: (prompt, seed) =>
      pollinationsImage(`${prompt}, ${STYLE}`, seed),
  },
  {
    id: 'pollinations_dark_fantasy',
    name: 'Pollinations — Dark Fantasy',
    description: 'Brooding atmosphere, chiaroscuro shadows.',
    fetchImage: (prompt, seed) =>
      pollinationsImage(
        `${prompt}, dark fantasy oil painting, brooding atmosphere, dramatic shadows, chiaroscuro, ${STYLE}`,
        seed,
      ),
  },
  {
    id: 'pollinations_painterly',
    name: 'Pollinations — Painterly',
    description: 'Impressionist brushstrokes, rich texture.',
    fetchImage: (prompt, seed) =>
      pollinationsImage(
        `${prompt}, impressionist oil painting, visible brushstrokes, rich texture, ${STYLE}`,
        seed,
      ),
  },
  {
    id: 'pollinations_anime',
    name: 'Pollinations — Anime',
    description: 'Anime / Studio Ghibli aesthetic.',
    fetchImage: (prompt, seed) =>
      pollinationsImage(
        `${prompt}, anime illustration, detailed line art, Studio Ghibli influence, vibrant colors`,
        seed,
      ),
  },
  {
    id: 'pollinations_portrait',
    name: 'Pollinations — Portrait',
    description: 'Tight portrait crop, character face emphasis.',
    fetchImage: (prompt, seed) =>
      pollinationsImage(
        `close up portrait, ${prompt}, ${STYLE}, shallow depth of field, face detail`,
        seed,
        512,
        640,
      ),
  },
  {
    id: 'pollinations_ink_sketch',
    name: 'Pollinations — Ink Sketch',
    description: 'Pen-and-ink etching, monochromatic.',
    fetchImage: (prompt, seed) =>
      pollinationsImage(
        `${prompt}, detailed pen and ink etching, crosshatching, monochromatic, medieval manuscript style`,
        seed,
      ),
  },
  {
    id: 'pollinations_widescreen',
    name: 'Pollinations — Widescreen',
    description: 'Wide cinematic environment shot.',
    fetchImage: (prompt, seed) =>
      pollinationsImage(
        `wide establishing shot, ${prompt}, ${STYLE}, epic scale, environment storytelling`,
        seed,
        1024,
        512,
      ),
  },
]

export const DEFAULT_SERVICE_ID = 'pollinations_default'

export function getService(id: string): ImageService {
  return IMAGE_SERVICES.find(s => s.id === id) ?? IMAGE_SERVICES[0]
}
