// src/hooks/useGameState.ts
import { useEffect, useState, useRef } from 'react'
import type { GameState } from '../types'

const POLL_MS = 2000

export function useGameState() {
  const [state, setState]       = useState<GameState | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const lastUpdated             = useRef<string>('')

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res  = await fetch('/api/state')
        if (!res.ok) {
          const err = await res.json()
          if (!cancelled) setError(err.error ?? 'Unknown error')
          return
        }
        const data: GameState = await res.json()
        if (!cancelled && data.updated_at !== lastUpdated.current) {
          lastUpdated.current = data.updated_at
          setState(data)
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) setError('Bridge server not reachable. Run: npm run server')
      }
    }

    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return { state, error, loading }
}
