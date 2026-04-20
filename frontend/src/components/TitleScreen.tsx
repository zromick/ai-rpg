import { useState, useEffect, useCallback } from 'react'

interface Props {
  googlePlayUser: { id: string; name: string } | null
  onGooglePlayLogin: (user: { id: string; name: string }) => void
  onGoogleLogout: () => void
  onGuestPlay: () => void
  saveSlots: Array<{ slot: number; hasData: boolean; characterName?: string }>
  onLoadSlot: (slot: number) => void
  onStartNew: () => void
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

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

async function getGoogleUserInfo(accessToken: string): Promise<string> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (res.ok) {
      const data = await res.json()
      return data.name || data.email?.split('@')[0] || 'Player'
    }
  } catch {}
  return 'Player'
}

export function TitleScreen({ googlePlayUser, onGooglePlayLogin, onGoogleLogout, onGuestPlay, saveSlots, onLoadSlot, onStartNew }: Props) {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false)
  const [showLoginError, setShowLoginError] = useState(false)
  const [userName, setUserName] = useState('Player')

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (googlePlayUser?.name && googlePlayUser.name !== 'Player') {
      setUserName(googlePlayUser.name)
    } else if (googlePlayUser?.id) {
      getGoogleUserInfo(googlePlayUser.id).then(name => {
        setUserName(name)
        onGooglePlayLogin({ ...googlePlayUser, name })
      })
    }
  }, [googlePlayUser])

  const handleGoogleLogin = useCallback(() => {
    setIsLoadingGoogle(true)
    setShowLoginError(false)

    const client = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile https://www.googleapis.com/auth/games',
      callback: async (response) => {
        if (response.access_token) {
          const name = await getGoogleUserInfo(response.access_token)
          onGooglePlayLogin({
            id: response.access_token,
            name
          })
        } else {
          setShowLoginError(true)
        }
        setIsLoadingGoogle(false)
      }
    })

    if (client) {
      client.requestAccessToken()
    } else {
      setIsLoadingGoogle(false)
      setShowLoginError(true)
    }

    setTimeout(() => {
      if (isLoadingGoogle) {
        setIsLoadingGoogle(false)
      }
    }, 5000)
  }, [onGooglePlayLogin])

  return (
    <div className="title-screen">
      <div className="title-screen-inner">
        <div className="title-crown">♛</div>
        <h1 className="title-name">AI RPG</h1>

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
                  {slot.hasData ? (slot.characterName ? `${slot.characterName}` : `Load Slot ${slot.slot}`) : `New Slot ${slot.slot}`}
                </button>
              ))}
            </>
          ) : (
            <button
              className="title-btn title-btn--secondary"
              onClick={handleGoogleLogin}
              disabled={isLoadingGoogle}
            >
              {isLoadingGoogle ? 'Signing in...' : 'Sign in with Google'}
            </button>
          )}
        </div>

        <div className="title-login-section">
          {googlePlayUser ? (
            <div className="title-user-info">
              <span className="title-user-badge">✓</span>
              Welcome, {userName}!
              <button className="title-logout-btn" onClick={onGoogleLogout}>Logout</button>
            </div>
          ) : (
            showLoginError && (
              <p className="title-login-error">Sign in failed. Click to try again.</p>
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
