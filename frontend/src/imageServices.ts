// src/imageServices.ts
// All services listed here work with a plain <img src="..."> — no API key,
// no async job polling, no JSON parsing. Just a URL that returns an image.
//
// Pollinations.ai is the backbone for most entries because it is genuinely
// free, reliable, and supports multiple model/style parameters.
// The non-Pollinations entries (Picsum, Robohash) are placeholders / novelties.

import type { ImageService } from './types'

const STYLE = 'medieval fantasy, dramatic lighting, painterly, cinematic composition, detailed, no text, no watermark, no UI'

function enc(s: string): string {
  return encodeURIComponent(s)
}

function pollinations(
  prompt: string,
  seed: number,
  model = 'flux',
  w = 768,
  h = 512,
): string {
  return `https://image.pollinations.ai/prompt/${enc(prompt)}?model=${model}&width=${w}&height=${h}&seed=${seed}&nologo=true&enhance=true`
}

export const IMAGE_SERVICES: ImageService[] = [
  {
    id: 'pollinations_flux',
    name: 'Pollinations — Flux (default)',
    description: 'Free, no key. Best quality. FLUX model.',
    buildUrl: (prompt, seed) =>
      pollinations(`${prompt}, ${STYLE}`, seed, 'flux'),
  },
  {
    id: 'pollinations_schnell',
    name: 'Pollinations — Flux Schnell',
    description: 'Free, no key. Faster generation, slightly lower quality.',
    buildUrl: (prompt, seed) =>
      pollinations(`${prompt}, ${STYLE}`, seed, 'flux-schnell'),
  },
  {
    id: 'pollinations_turbo',
    name: 'Pollinations — Turbo',
    description: 'Free, no key. SD Turbo backend — very fast.',
    buildUrl: (prompt, seed) =>
      pollinations(`${prompt}, ${STYLE}`, seed, 'turbo'),
  },
  {
    id: 'pollinations_dark',
    name: 'Pollinations — Dark Fantasy',
    description: 'Free, no key. FLUX with dark fantasy art direction.',
    buildUrl: (prompt, seed) =>
      pollinations(
        `${prompt}, dark fantasy oil painting, brooding atmosphere, dramatic shadows, chiaroscuro, ${STYLE}`,
        seed, 'flux',
      ),
  },
  {
    id: 'pollinations_painterly',
    name: 'Pollinations — Painterly',
    description: 'Free, no key. FLUX with impressionist brushstroke styling.',
    buildUrl: (prompt, seed) =>
      pollinations(
        `${prompt}, impressionist oil painting, visible brushstrokes, rich texture, ${STYLE}`,
        seed, 'flux',
      ),
  },
  {
    id: 'pollinations_anime',
    name: 'Pollinations — Anime',
    description: 'Free, no key. Illustrated anime / manga aesthetic.',
    buildUrl: (prompt, seed) =>
      pollinations(
        `${prompt}, anime illustration, detailed line art, Studio Ghibli influence, vibrant colors`,
        seed, 'flux',
      ),
  },
  {
    id: 'pollinations_portrait',
    name: 'Pollinations — Portrait Focus',
    description: 'Free, no key. Tight portrait crop, character face emphasis.',
    buildUrl: (prompt, seed) =>
      pollinations(
        `close up portrait, ${prompt}, ${STYLE}, shallow depth of field, face detail`,
        seed, 'flux', 512, 640,
      ),
  },
  {
    id: 'pollinations_sketch',
    name: 'Pollinations — Ink Sketch',
    description: 'Free, no key. Pen-and-ink / etching style.',
    buildUrl: (prompt, seed) =>
      pollinations(
        `${prompt}, detailed pen and ink etching, crosshatching, monochromatic, medieval manuscript style`,
        seed, 'flux',
      ),
  },
  {
    id: 'pollinations_widescreen',
    name: 'Pollinations — Widescreen Scene',
    description: 'Free, no key. Wide cinematic shot, environment-focused.',
    buildUrl: (prompt, seed) =>
      pollinations(
        `wide establishing shot, ${prompt}, ${STYLE}, epic scale, environment storytelling`,
        seed, 'flux', 1024, 512,
      ),
  },
  {
    id: 'picsum',
    name: 'Lorem Picsum (placeholder)',
    description: 'Random scenic photo. No AI — useful for layout testing.',
    buildUrl: (_prompt, seed) =>
      `https://picsum.photos/seed/${seed % 1000}/768/512`,
  },
]

export const DEFAULT_SERVICE_ID = 'pollinations_flux'

export function getService(id: string): ImageService {
  return IMAGE_SERVICES.find(s => s.id === id) ?? IMAGE_SERVICES[0]
}
