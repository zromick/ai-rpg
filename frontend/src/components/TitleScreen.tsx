import { useState, useEffect, useCallback, useRef } from 'react'
import { useSnackbar } from './Snackbar'

interface Props {
  googlePlayUser: { id: string; name: string } | null
  googleDisplayName: string
  onGooglePlayLogin: (user: { id: string; name: string }) => void
  onGoogleLogout: () => void
  onGuestPlay: () => void
  saveSlots: Array<{ slot: number; hasData: boolean; characterName?: string; scenario?: string; turn?: number; themeColor?: string }>
  onLoadSlot: (slot: number) => void
  onStartNew: (slot: number) => void
  onDeleteSlot?: (slot: number) => void
  onDeleteAllSlots?: () => void
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

export function TitleScreen({ googlePlayUser, googleDisplayName, onGooglePlayLogin, onGoogleLogout, onGuestPlay, saveSlots, onLoadSlot, onStartNew, onDeleteAllSlots }: Props) {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false)
  const [showLoginError, setShowLoginError] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const { snackbar } = useSnackbar()
  // Tracks whether the in-flight login attempt has settled, so the timeout
  // doesn't fire a stale "failed" toast after a successful callback.
  const loginSettledRef = useRef(true)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (googlePlayUser && !googlePlayUser.name) {
      getGoogleUserInfo(googlePlayUser.id).then(name => {
        onGooglePlayLogin({ ...googlePlayUser, name })
      })
    }
  }, [googlePlayUser])

  const finishLogin = useCallback((kind: 'success' | 'failure', message: string) => {
    if (loginSettledRef.current) return
    loginSettledRef.current = true
    setIsLoadingGoogle(false)
    if (kind === 'success') {
      snackbar.success(message)
    } else {
      setShowLoginError(true)
      snackbar.error(message)
    }
  }, [snackbar])

  const handleGoogleLogin = useCallback(() => {
    // Hard-fail before we even try if the build doesn't have a client id.
    if (!GOOGLE_CLIENT_ID) {
      snackbar.error('Login failed — Google Client ID is not configured. Add VITE_GOOGLE_CLIENT_ID to your .env.')
      setShowLoginError(true)
      return
    }

    setIsLoadingGoogle(true)
    setShowLoginError(false)
    loginSettledRef.current = false

    // 8s timeout: if Google's popup is blocked, the user dismisses it, or
    // the gsi script never loaded, we still resolve to a clear failure
    // instead of an indefinite "Signing in..." spinner.
    const timeoutId = window.setTimeout(() => {
      finishLogin('failure', 'Login failed — timed out waiting for Google.')
    }, 8000)

    let client: { requestAccessToken: () => void } | undefined
    try {
      client = window.google?.accounts?.oauth2?.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile https://www.googleapis.com/auth/games',
        callback: async (response) => {
          window.clearTimeout(timeoutId)
          if (response.access_token) {
            try {
              const name = await getGoogleUserInfo(response.access_token)
              onGooglePlayLogin({ id: response.access_token, name })
              finishLogin('success', `Signed in as ${name}`)
            } catch {
              finishLogin('failure', 'Login failed — could not fetch your Google profile.')
            }
          } else {
            finishLogin('failure', 'Login failed — Google did not return a token.')
          }
        },
      })
    } catch {
      window.clearTimeout(timeoutId)
      finishLogin('failure', 'Login failed — Google sign-in script could not initialize.')
      return
    }

    if (!client) {
      window.clearTimeout(timeoutId)
      finishLogin('failure', 'Login failed — Google sign-in script not loaded yet. Try again in a moment.')
      return
    }
    client.requestAccessToken()
  }, [onGooglePlayLogin, finishLogin, snackbar])

  return (
    <div className="title-screen">
      <div className="title-screen-inner">
        <div className="title-header">
          <span className="title-crown">♛</span>
          <h1 className="title-name">AI RPG</h1>
        </div>

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
                  style={slot.hasData && slot.themeColor ? { borderColor: slot.themeColor, background: `${slot.themeColor}15` } : undefined}
                  onClick={() => slot.hasData ? onLoadSlot(slot.slot) : onStartNew(slot.slot)}
                >
                  {slot.hasData ? (
                    <div className="title-slot-info">
                      <span className="title-slot-name">{slot.characterName || `Slot ${slot.slot}`}</span>
                      <span className="title-slot-meta">{slot.scenario} · Turn {slot.turn ?? '?'}</span>
                    </div>
                  ) : `New Slot ${slot.slot}`}
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
              Welcome, {googleDisplayName}!
              <button className="title-logout-btn" onClick={onGoogleLogout}>Logout</button>
              {onDeleteAllSlots && (
                <button
                  className="title-delete-all-btn"
                  onClick={() => deleteConfirm ? (onDeleteAllSlots(), setDeleteConfirm(false)) : setDeleteConfirm(true)}
                >
                  {deleteConfirm ? 'Confirm Delete All' : 'Delete All Saves'}
                </button>
              )}
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
