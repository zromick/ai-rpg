import { useEffect, useState, useRef, useCallback } from 'react'
import type { GameState, SetupState } from '../types'

const POLL_MS = 1500

export function useGameState() {
  const [gameState, setGameState]   = useState<GameState | null>(null)
  const [setupState, setSetupState] = useState<SetupState | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const lastUpdated                 = useRef('')
  const lastSessionId               = useRef('')
  const lastSetupAt                 = useRef('')

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        // Poll setup state (shown when no game running)
        if (!gameState) {
          const sr = await fetch('/api/setup')
          if (sr.ok) {
            const sd = await sr.json() as SetupState
            if (!cancelled && sd.updated_at !== lastSetupAt.current) {
              lastSetupAt.current = sd.updated_at
              setSetupState(sd)
              setLoading(false)
            }
          }
        }
        // Poll game state
        const gr = await fetch('/api/state')
        if (!gr.ok) {
          if (!cancelled && !gameState) setLoading(false)
          return
        }
        const gd = await gr.json() as GameState
        if (cancelled) return
        if (gd.session_id !== lastSessionId.current) {
          lastSessionId.current = gd.session_id
          lastUpdated.current   = ''
          setGameState(null)
        }
        if (gd.updated_at !== lastUpdated.current) {
          lastUpdated.current = gd.updated_at
          setGameState(gd)
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
  }, [gameState])

  const sendCommand = useCallback(async (player: string, text: string): Promise<boolean> => {
    try {
      const r = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player, text }) })
      return r.ok
    } catch { return false }
  }, [])

  return { gameState, setupState, error, loading, sendCommand }
}
