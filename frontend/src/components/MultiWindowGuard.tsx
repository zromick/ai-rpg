import { useState, useEffect, useCallback, useRef } from 'react'

const WINDOW_CHANNEL_NAME = 'ai-rpg-window-guard'

export function MultiWindowGuard({ children }: { children: React.ReactNode }) {
  const [secondWindowDetected, setSecondWindowDetected] = useState(false)
  const [hasDismissed, setHasDismissed] = useState(false)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const myIdRef = useRef<string>('')
  const dismissedRef = useRef(false)

  useEffect(() => {
    myIdRef.current = `window-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    channelRef.current = new BroadcastChannel(WINDOW_CHANNEL_NAME)

    const channel = channelRef.current

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'ping') {
        if (!dismissedRef.current) {
          channel.postMessage({ type: 'pong', from: myIdRef.current })
        }
      } else if (event.data.type === 'pong') {
        if (!dismissedRef.current) {
          setSecondWindowDetected(true)
        }
      }
    }

    channel.onmessage = handleMessage
    channel.postMessage({ type: 'ping', from: myIdRef.current })

    const checkInterval = setInterval(() => {
      if (!dismissedRef.current) {
        channel.postMessage({ type: 'ping', from: myIdRef.current })
      }
    }, 3000)

    return () => {
      clearInterval(checkInterval)
      channel.close()
    }
  }, [])

  const handleResume = useCallback(() => {
    dismissedRef.current = true
    setHasDismissed(true)
  }, [])

  if (secondWindowDetected && !hasDismissed) {
    return (
      <div className="multiwindow-guard">
        <div className="multiwindow-modal">
          <div className="multiwindow-icon">⚠️</div>
          <h2 className="multiwindow-title">Multiple Windows Detected</h2>
          <p className="multiwindow-text">
            Another window of AI RPG has been detected. Running multiple instances can cause issues with game state.
          </p>
          <p className="multiwindow-hint">
            Please close all other windows and click "Resume" to continue playing.
          </p>
          <button className="multiwindow-btn" onClick={handleResume}>
            Resume Playing
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}