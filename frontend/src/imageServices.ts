// src/imageServices.ts

import type { ImageService } from './types'

const BRIDGE_API = '/api'

const STYLE =
  'medieval fantasy, dramatic lighting, painterly, cinematic composition, detailed, no text, no watermark, no UI'

async function hfImage(
  model: string,
  prompt: string,
  seed: number,
  width = 768,
  height = 512,
): Promise<string> {
  const response = await fetch(`${BRIDGE_API}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, seed, width, height, num_inference_steps: 4 }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error')
    throw new Error(`HF API error: ${err}`)
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

// ── Type update ──────────────────────────────────────────────────────────────
// ImageService now uses fetchImage instead of buildUrl.
// Update your types.ts accordingly:
//
//   export interface ImageService {
//     id: string
//     name: string
//     description: string
//     fetchImage: (prompt: string, seed: number) => Promise<string>
//   }
// ────────────────────────────────────────────────────────────────────────────

export const IMAGE_SERVICES: ImageService[] = [
  {
    id: 'hf_flux_schnell',
    name: 'HF — FLUX.1 Schnell (fast)',
    description: 'Black Forest Labs FLUX schnell. 4 steps, very fast.',
    fetchImage: (prompt, seed) =>
      hfImage('black-forest-labs/FLUX.1-schnell', `${prompt}, ${STYLE}`, seed),
  },
  {
    id: 'hf_flux_dev',
    name: 'HF — FLUX.1 Dev (quality)',
    description: 'FLUX dev model. Higher quality, slightly slower.',
    fetchImage: (prompt, seed) =>
      hfImage('black-forest-labs/FLUX.1-dev', `${prompt}, ${STYLE}`, seed),
  },
  {
    id: 'hf_dark_fantasy',
    name: 'HF — Dark Fantasy',
    description: 'FLUX schnell with dark fantasy art direction.',
    fetchImage: (prompt, seed) =>
      hfImage(
        'black-forest-labs/FLUX.1-schnell',
        `${prompt}, dark fantasy oil painting, brooding atmosphere, dramatic shadows, chiaroscuro, ${STYLE}`,
        seed,
      ),
  },
  {
    id: 'hf_painterly',
    name: 'HF — Painterly',
    description: 'FLUX schnell with impressionist brushstroke styling.',
    fetchImage: (prompt, seed) =>
      hfImage(
        'black-forest-labs/FLUX.1-schnell',
        `${prompt}, impressionist oil painting, visible brushstrokes, rich texture, ${STYLE}`,
        seed,
      ),
  },
  {
    id: 'hf_anime',
    name: 'HF — Anime',
    description: 'FLUX schnell with anime / Studio Ghibli aesthetic.',
    fetchImage: (prompt, seed) =>
      hfImage(
        'black-forest-labs/FLUX.1-schnell',
        `${prompt}, anime illustration, detailed line art, Studio Ghibli influence, vibrant colors`,
        seed,
      ),
  },
  {
    id: 'hf_portrait',
    name: 'HF — Portrait Focus',
    description: 'Tight portrait crop, character face emphasis.',
    fetchImage: (prompt, seed) =>
      hfImage(
        'black-forest-labs/FLUX.1-schnell',
        `close up portrait, ${prompt}, ${STYLE}, shallow depth of field, face detail`,
        seed,
        512,
        640,
      ),
  },
  {
    id: 'hf_ink_sketch',
    name: 'HF — Ink Sketch',
    description: 'Pen-and-ink etching style.',
    fetchImage: (prompt, seed) =>
      hfImage(
        'black-forest-labs/FLUX.1-schnell',
        `${prompt}, detailed pen and ink etching, crosshatching, monochromatic, medieval manuscript style`,
        seed,
      ),
  },
  {
    id: 'hf_widescreen',
    name: 'HF — Widescreen Scene',
    description: 'Wide cinematic environment shot.',
    fetchImage: (prompt, seed) =>
      hfImage(
        'black-forest-labs/FLUX.1-schnell',
        `wide establishing shot, ${prompt}, ${STYLE}, epic scale, environment storytelling`,
        seed,
        1024,
        512,
      ),
  },
]

export const DEFAULT_SERVICE_ID = 'hf_flux_schnell'

export function getService(id: string): ImageService {
  return IMAGE_SERVICES.find(s => s.id === id) ?? IMAGE_SERVICES[0]
}
