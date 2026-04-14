// src/hooks/useGameState.ts
import { useEffect, useState, useRef, useCallback } from 'react'
import type { GameState } from '../types'

const POLL_MS = 1500

export function useGameState() {
  const [state, setState]     = useState<GameState | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const lastUpdated           = useRef<string>('')
  const lastSessionId         = useRef<string>('')

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch('/api/state')
        if (!res.ok) {
          const err = await res.json() as { error?: string }
          if (!cancelled) { setError(err.error ?? 'Unknown error'); setLoading(false) }
          return
        }
        const data = await res.json() as GameState

        if (cancelled) return

        // New cargo run detected — reset everything
        if (data.session_id !== lastSessionId.current) {
          lastSessionId.current = data.session_id
          lastUpdated.current   = ''
          setState(null)        // briefly clear so App shows splash
        }

        if (data.updated_at !== lastUpdated.current) {
          lastUpdated.current = data.updated_at
          setState(data)
          setError(null)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setError('Bridge server unreachable — run: npm run server')
      }
    }

    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Send a command to the Rust game via the bridge
  const sendCommand = useCallback(async (player: string, text: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, text }),
      })
      return res.ok
    } catch {
      return false
    }
  }, [])

  return { state, error, loading, sendCommand }
}
