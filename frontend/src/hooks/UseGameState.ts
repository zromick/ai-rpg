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
  const lastErrorCheck              = useRef(0)
  const pendingCommand              = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      const now = Date.now()
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
          if (!cancelled) {
            if (gameState) {
              // Game state file was removed (e.g. title/restart) — reset to show setup
              setGameState(null)
              lastUpdated.current = ''
              lastSessionId.current = ''
            }
            setLoading(false)
          }
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
          pendingCommand.current = false
        }

        // Check for Rust errors only when: (1) state changed, (2) after command sent, or (3) every 20 sec
        const stateChanged = gd.updated_at !== lastUpdated.current || pendingCommand.current
        const timeSinceCheck = now - lastErrorCheck.current
        if (stateChanged || timeSinceCheck > 20000) {
          lastErrorCheck.current = now
          try {
            const er = await fetch('/api/error')
            if (er.ok) {
              const ed = await er.json() as { error?: string }
              if (!cancelled && ed.error) {
                setError(ed.error)
                await fetch('/api/error', { method: 'DELETE' })
              }
            }
            // 404 = no error file exists yet - that's fine, don't log it
          } catch {
            // Error endpoint unreachable - that's fine
          }
        }
      } catch {
        if (!cancelled) setError('Bridge server unreachable — run: npm run start')
      }
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [gameState])

  // Single one-shot error fetch. Previously this retried 8 times at 600ms
  // intervals after every command, which the player flagged as too noisy. The
  // regular poll picks up errors on a 20s cadence; if the command immediately
  // failed the Rust process writes ERROR_FILE before responding to the next
  // poll, so a single check here is enough.
  const checkError = useCallback(async () => {
    try {
      const er = await fetch('/api/error')
      if (er.ok) {
        const ed = await er.json() as { error?: string }
        if (ed.error) { setError(ed.error); await fetch('/api/error', { method: 'DELETE' }) }
      }
    } catch { /* ignore */ }
  }, [])

  const sendCommand = useCallback(async (player: string, text: string): Promise<boolean> => {
    pendingCommand.current = true
    lastErrorCheck.current = Date.now()
    try {
      const response = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player, text }) })
      // Defer the post-command error check so the Rust process has time to
      // actually write ERROR_FILE if the command failed. Without the delay
      // we'd race and miss the error.
      if (response.ok) setTimeout(() => { void checkError() }, 1500)
      return response.ok
    } catch {
      return false
    }
  }, [checkError])

  return { gameState, setupState, error, loading, sendCommand }
}
