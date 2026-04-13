// src/hooks/useCharacterImage.ts
// Builds a scene image using whichever ImageService the user has selected.
// All services are free and require no API key.

import { useEffect, useState } from 'react'
import type { ImageService } from '../types'

function buildScenePrompt(imagePrompt: string, gmReply: string): string {
  const firstSentence = gmReply.split(/[.!?]/)[0]?.trim() ?? ''
  const action = firstSentence.length > 80
    ? firstSentence.slice(0, 80) + '…'
    : firstSentence
  return [
    'character portrait and action scene',
    imagePrompt,
    action ? `actively: ${action}` : '',
  ].filter(Boolean).join(', ')
}

export function useCharacterImage(
  imagePrompt: string,
  gmReply: string,
  seed: number,
  service: ImageService,
) {
  const [url, setUrl]         = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!imagePrompt || !gmReply) return

    const prompt   = buildScenePrompt(imagePrompt, gmReply)
    const imageUrl = service.buildUrl(prompt, seed)

    setLoading(true)
    setError(null)
    setUrl('')

    const img    = new Image()
    img.onload   = () => { setUrl(imageUrl); setLoading(false) }
    img.onerror  = () => { setError(`${service.name} failed to return an image`); setLoading(false) }
    img.src      = imageUrl
  }, [imagePrompt, gmReply, seed, service.id])

  return { url, loading, error }
}
