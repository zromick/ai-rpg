import { useState, useEffect } from 'react'

interface Props {
  googlePlayUser: { id: string; name: string } | null
  onGooglePlayLogin: (user: { id: string; name: string }) => void
  onGuestPlay: () => void
  saveSlots: Array<{ slot: number; hasData: boolean }>
  onLoadSlot: (slot: number) => void
  onStartNew: () => void
}

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_PLAY_CLIENT_ID.apps.googleusercontent.com'

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

export function TitleScreen({ googlePlayUser, onGooglePlayLogin, onGuestPlay, saveSlots, onLoadSlot, onStartNew }: Props) {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false)
  const [showLoginError, setShowLoginError] = useState(false)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    document.body.appendChild(script)
  }, [])

  const handleGoogleLogin = () => {
    setIsLoadingGoogle(true)
    setShowLoginError(false)

    const client = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/games',
      callback: (response) => {
        setIsLoadingGoogle(false)
        if (response.access_token) {
          onGooglePlayLogin({
            id: response.access_token.substring(0, 20),
            name: 'Player'
          })
        } else if (response.error) {
          setShowLoginError(true)
        }
      }
    })
    client?.requestAccessToken()
  }

  return (
    <div className="title-screen">
      <div className="title-screen-inner">
        <div className="title-crown">♛</div>
        <h1 className="title-name">AI RPG</h1>
        <p className="title-subtitle">Beggars to Crowns</p>

        <div className="title-buttons">
          <button className="title-btn title-btn--secondary" onClick={onGuestPlay}>
            Play as Guest
          </button>
          
          {googlePlayUser ? (
            <>
              {saveSlots.map(slot => (
                <button
                  key={slot.slot}
                  className={`title-btn ${slot.hasData ? 'title-btn--primary' : 'title-btn--secondary'}`}
                  onClick={() => slot.hasData ? onLoadSlot(slot.slot) : onStartNew()}
                >
                  {slot.hasData ? `Load Slot ${slot.slot}` : `New Slot ${slot.slot}`}
                </button>
              ))}
            </>
          ) : (
            <button className="title-btn title-btn--secondary" onClick={handleGoogleLogin} disabled={isLoadingGoogle}>
              {isLoadingGoogle ? 'Signing in...' : 'Sign in with Google'}
            </button>
          )}
        </div>

        <div className="title-login-section">
          {googlePlayUser ? (
            <div className="title-user-info">
              <span className="title-user-badge">✓</span>
              Signed in as {googlePlayUser.name}
            </div>
          ) : (
            showLoginError && (
              <p className="title-login-error">Failed to sign in. Please try again.</p>
            )
          )}
        </div>

        <div className="title-footer">
          <p>Powered by HuggingFace Inference API</p>
        </div>
      </div>
    </div>
  )
}