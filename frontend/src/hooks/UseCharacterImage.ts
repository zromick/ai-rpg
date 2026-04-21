// src/hooks/useCharacterImage.ts
// Pollinations.ai can take 5-30 seconds to generate an image.
// We set the URL immediately and let the <img> element handle the loading state
// via onLoad/onError rather than pre-loading with new Image(), which was timing out.

import { useMemo, useState, useEffect } from 'react'
import type { ImageService } from '../types'

const STYLE = 'medieval fantasy art, dramatic lighting, painterly, cinematic, detailed, no text, no watermark, no UI elements'

export function buildScenePrompt(imagePrompt: string, gmReply: string): string {
  // Take first sentence of GM reply as the "action" description
  const sentence = gmReply.split(/(?<=[.!?])\s/)[0]?.trim() ?? ''
  const action   = sentence.length > 100 ? sentence.slice(0, 100) : sentence
  return [
    imagePrompt,
    action ? `scene: ${action}` : '',
    STYLE,
  ].filter(Boolean).join(', ')
}

export function useCharacterImage(
  imagePrompt: string,
  gmReply: string,
  seed: number,
  service: ImageService,
) {
  const [url, setUrl] = useState('')

  const prompt = useMemo(() => {
    if (!imagePrompt || !gmReply) return ''
    return buildScenePrompt(imagePrompt, gmReply)
  }, [imagePrompt, gmReply])

  useEffect(() => {
    if (!prompt || !service.fetchImage) return
    let canceled = false

    service.fetchImage(prompt, seed).then(url => {
      if (!canceled) setUrl(url)
    }).catch(() => {
      if (!canceled) setUrl('')
    })

    return () => { canceled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, seed, service.id]) // service.fetchImage intentionally omitted - function refs change on every render

  return { url }
}
