import { useState, useEffect, useCallback, useRef } from 'react'

const WINDOW_CHANNEL_NAME = 'ai-rpg-window-guard'

export function MultiWindowGuard({ children }: { children: React.ReactNode }) {
  const [secondWindowDetected, setSecondWindowDetected] = useState(false)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const myIdRef = useRef<string>('')

  useEffect(() => {
    myIdRef.current = `window-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    channelRef.current = new BroadcastChannel(WINDOW_CHANNEL_NAME)

    const channel = channelRef.current

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.from === myIdRef.current) return
      if (event.data?.type === 'ping') {
        channel.postMessage({ type: 'pong', from: myIdRef.current })
      } else if (event.data?.type === 'pong') {
        setSecondWindowDetected(true)
      }
    }

    channel.onmessage = handleMessage
    channel.postMessage({ type: 'ping', from: myIdRef.current })

    const checkInterval = setInterval(() => {
      channel.postMessage({ type: 'ping', from: myIdRef.current })
    }, 3000)

    return () => {
      clearInterval(checkInterval)
      channel.close()
    }
  }, [])

  // Resume re-pings the channel. If another window is still alive it will
  // pong back and the modal will pop right back open. We don't permanently
  // dismiss the warning — that would let users play in two windows by just
  // clicking through.
  const handleResume = useCallback(() => {
    setSecondWindowDetected(false)
    channelRef.current?.postMessage({ type: 'ping', from: myIdRef.current })
  }, [])

  if (secondWindowDetected) {
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
