import { useState, useEffect, useCallback, useRef } from 'react'
import { CharacterPanel } from './components/CharacterPanel'
import { Terminal } from './components/Terminal'
import { QuestPanel } from './components/QuestPanel'
import { PlayerTabs } from './components/PlayerTabs'
import AmbientRadio from './components/AmbientRadio'
import Narrator from './components/Narrator'
import { getService, DEFAULT_SERVICE_ID } from './imageServices'
import type { ImageService } from './types'
import { SettingsPanel } from './components/SettingsPanel'
import { useGameState } from './hooks/UseGameState'
import { SetupPayload, SetupWizard } from './components/SetupWizard'
import { TitleScreen } from './components/TitleScreen'
import { SplashScreen } from './components/SplashScreen'
import { GameStartSplash } from './components/GameStartSplash'
import { MultiWindowGuard } from './components/MultiWindowGuard'
import { SnackbarProvider, useSnackbar } from './components/Snackbar'

// Where we stash the Google login session. Previously this used
// 'ai_rpg_save_slot_1', which collided with slot 1's actual game data and
// silently wiped Rosalyn whenever Coralyx logged in. Use a distinct key.
const GOOGLE_SESSION_KEY = 'ai_rpg_google_session'
const CURRENT_SLOT_KEY = 'ai_rpg_current_slot'
const MOBILE_BREAKPOINT = 768

function nameSeed(name: string): number {
  let h = 0; for (const c of name) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0; return Math.abs(h)
}

const FAKE_SETUP_PLAYER = '__setup__'

export default function App() {
  const { gameState, setupState, error, loading, sendCommand } = useGameState()
  const { snackbar } = useSnackbar()
  const [selectedPlayer, setSelectedPlayer]     = useState('')
  const [imageService, setImageService]     = useState<ImageService>(getService(DEFAULT_SERVICE_ID))
  const [showSettings, setShowSettings]     = useState(false)
  const [showSplash, setShowSplash] = useState(false)
  const [showTitle, setShowTitle] = useState(true)
  const [mobileView, setMobileView] = useState<'quest' | 'terminal' | 'character'>('terminal')
  const [isMobileSize, setIsMobileSize] = useState(false)
  // Persist the active slot across page refreshes. Otherwise a refresh would
  // reset currentSlot to 1, and the auto-save effect below would then dump
  // the live game (e.g. Coralyx in slot 3) on top of slot 1's saved game.
  const [currentSlot, setCurrentSlot] = useState<number>(() => {
    try {
      const v = localStorage.getItem(CURRENT_SLOT_KEY)
      if (v) {
        const n = parseInt(v, 10)
        if (n >= 1 && n <= 4) return n
      }
    } catch {}
    return 1
  })
  useEffect(() => {
    try { localStorage.setItem(CURRENT_SLOT_KEY, String(currentSlot)) } catch {}
  }, [currentSlot])
  const [justRestored, setJustRestored] = useState(false)
  const [isLoadingGame, setIsLoadingGame] = useState(false)
  const [startNewGame, setStartNewGame] = useState(false)
  // Optimistic overrides for color-toggle settings. The Rust round-trip can take
  // 1-2 seconds; toggles should look instant. When new gameState arrives we
  // clear any override that now matches the authoritative value.
  const [colorOverrides, setColorOverrides] = useState<{ character?: boolean; location?: boolean }>({})
  // Tracks per-session ids we've already shown the game-start splash for.
  // Resets implicitly on a new session because the id changes.
  const [gameStartSplashDismissedFor, setGameStartSplashDismissedFor] = useState<string>('')

  // Resizable side panes. Defaults match the previous fixed values (240px /
  // 300px), which act as the minimum widths — users can only DRAG outward.
  // Both widths are persisted across sessions.
  const LEFT_MIN = 240
  const LEFT_MAX = 520
  const RIGHT_MIN = 300
  const RIGHT_MAX = 600
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(() => {
    try {
      const v = localStorage.getItem('ai_rpg_left_pane_w')
      if (v) {
        const n = parseInt(v, 10)
        if (!Number.isNaN(n) && n >= LEFT_MIN && n <= LEFT_MAX) return n
      }
    } catch {}
    return LEFT_MIN
  })
  const [rightPaneWidth, setRightPaneWidth] = useState<number>(() => {
    try {
      const v = localStorage.getItem('ai_rpg_right_pane_w')
      if (v) {
        const n = parseInt(v, 10)
        if (!Number.isNaN(n) && n >= RIGHT_MIN && n <= RIGHT_MAX) return n
      }
    } catch {}
    return RIGHT_MIN
  })
  useEffect(() => {
    try { localStorage.setItem('ai_rpg_left_pane_w', String(leftPaneWidth)) } catch {}
  }, [leftPaneWidth])
  useEffect(() => {
    try { localStorage.setItem('ai_rpg_right_pane_w', String(rightPaneWidth)) } catch {}
  }, [rightPaneWidth])

  // Pointer-driven resize. We capture the starting X and width, then update
  // the width in mousemove until release. clamping keeps the pane within
  // [MIN, MAX] regardless of where the cursor goes.
  const startResize = useCallback((side: 'left' | 'right', e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = side === 'left' ? leftPaneWidth : rightPaneWidth
    const min = side === 'left' ? LEFT_MIN : RIGHT_MIN
    const max = side === 'left' ? LEFT_MAX : RIGHT_MAX
    const setter = side === 'left' ? setLeftPaneWidth : setRightPaneWidth
    const dir = side === 'left' ? 1 : -1   // dragging right grows left pane; dragging left grows right pane
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) * dir
      const next = Math.max(min, Math.min(max, startW + dx))
      setter(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [leftPaneWidth, rightPaneWidth])

  // Persisted UI zoom (default 1.0). Range 0.7–1.5 in 0.1 steps. Applied as a
  // CSS variable on the .app root; .app uses font-size: calc(1rem * var(--ui-zoom)).
  const [uiZoom, setUiZoom] = useState<number>(() => {
    try {
      const v = localStorage.getItem('ai_rpg_ui_zoom')
      if (v) {
        const n = parseFloat(v)
        if (!Number.isNaN(n) && n >= 0.7 && n <= 1.5) return n
      }
    } catch {}
    return 1.0
  })
  useEffect(() => {
    try { localStorage.setItem('ai_rpg_ui_zoom', String(uiZoom)) } catch {}
    document.documentElement.style.setProperty('--ui-zoom', String(uiZoom))
  }, [uiZoom])
  const zoomIn  = useCallback(() => setUiZoom(z => Math.min(1.5, +(z + 0.1).toFixed(2))), [])
  const zoomOut = useCallback(() => setUiZoom(z => Math.max(0.7, +(z - 0.1).toFixed(2))), [])
  // Tracks the last session_id we fired a "loaded/started" snackbar for, so we
  // don't re-toast on every state poll.
  const announcedSessionRef = useRef<string>('')
  // Whether the next session_id we see should be announced as "started" (after
  // a fresh setup) or "loaded" (after restoring from a slot).
  const pendingGameAnnouncement = useRef<'started' | 'loaded' | null>(null)
  const [googlePlayUser, setGooglePlayUser] = useState<{ id: string; name: string } | null>(() => {
    try {
      const saved = localStorage.getItem(GOOGLE_SESSION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.googlePlayUser) return parsed.googlePlayUser
      }
    } catch {}
    return null
  })
const MODEL_BY_ID: Record<string, string> = {
    'meta-llama/llama-3.3-70b-instruct': 'meta-llama/Llama-3.3-70B-Instruct',
    'qwen/qwen2.5-72b-instruct': 'Qwen/Qwen2.5-72B-Instruct',
    'meta-llama/llama-3.1-8b-instruct': 'meta-llama/Llama-3.1-8B-Instruct',
    'meta-llama/llama-3.1-8binstruct': 'meta-llama/Llama-3.1-8B-Instruct',
    'meta-llama/llama-3-1-8b-instruct': 'meta-llama/Llama-3.1-8B-Instruct',
    'google/gemma-2-9b-it': 'google/gemma-2-9b-it',
    'mistralai/mistral-7b-instruct-v0.3': 'mistralai/Mistral-7B-Instruct-v0.3',
    'mistralai/mistral-nemo-instruct-2407': 'mistralai/Mistral-Nemo-Instruct-2407',
    'huggingfaceh4/zephyr-7b-beta': 'HuggingFaceH4/zephyr-7b-beta',
    'nousresearch/hermes-3-llama-3.1-8b': 'NousResearch/Hermes-3-Llama-3.1-8B',
    'mistralai/mixtral-8x7b-instruct-v0.1': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    'microsoft/phi-3-medium-128k-instruct': 'microsoft/Phi-3-medium-128k-instruct',
  }

  const DEFAULT_MODEL_ID = 'meta-llama/Llama-3.3-70B-Instruct'
  const KNOWN_MODEL_IDS = new Set(Object.values(MODEL_BY_ID))

  function normalizeModel(m: string): string {
    if (!m) return m
    const lower = m.toLowerCase()
    if (MODEL_BY_ID[lower]) return MODEL_BY_ID[lower]
    for (const [, v] of Object.entries(MODEL_BY_ID)) {
      if (v.toLowerCase() === lower) return v
    }
    if (!KNOWN_MODEL_IDS.has(m)) return DEFAULT_MODEL_ID
    return m
  }
  const [models] = useState(() => [
    { label:'Llama 3.3 70B Instruct (default)', id: DEFAULT_MODEL_ID },
    { label:'Qwen 2.5 72B Instruct',           id:'Qwen/Qwen2.5-72B-Instruct' },
    { label:'Mistral Nemo 2407',               id:'mistralai/Mistral-Nemo-Instruct-2407' },
    { label:'Llama 3.1 8B Instruct',           id:'meta-llama/Llama-3.1-8B-Instruct' },
    { label:'Gemma 2 9B IT',                   id:'google/gemma-2-9b-it' },
    { label:'Mistral 7B v0.3',                 id:'mistralai/Mistral-7B-Instruct-v0.3' },
    { label:'Zephyr 7B Beta',                  id:'HuggingFaceH4/zephyr-7b-beta' },
    { label:'Hermes 3 Llama 3.1 8B',           id:'NousResearch/Hermes-3-Llama-3.1-8B' },
    { label:'Mixtral 8x7B',                    id:'mistralai/Mixtral-8x7B-Instruct-v0.1' },
    { label:'Phi-3 Medium 128k',               id:'microsoft/Phi-3-medium-128k-instruct' },
  ])

  useEffect(() => {
    if (gameState?.active_player) {
      setSelectedPlayer(prev => prev && gameState.players.find(p => p.name === prev) ? prev : gameState.active_player)
    }
  }, [gameState?.active_player])

  useEffect(() => {
    // Clear the loading-game gate as soon as a game state arrives. This
    // previously also gated on `justRestored`, which was never set on the
    // slot-load path — so isLoadingGame stayed `true` forever and the
    // terminal input rejected every keystroke. The justRestored flag is
    // still cleared here for any path that sets it.
    if (gameState) {
      if (justRestored) setJustRestored(false)
      setIsLoadingGame(false)
    }
  }, [gameState, justRestored])

  // Announce game lifecycle events (started / loaded) once per session_id.
  useEffect(() => {
    if (!gameState?.session_id) return
    if (announcedSessionRef.current === gameState.session_id) return
    announcedSessionRef.current = gameState.session_id
    if (pendingGameAnnouncement.current === 'started') {
      snackbar.success(`New game started — ${gameState.scenario}`)
    } else if (pendingGameAnnouncement.current === 'loaded') {
      snackbar.success(`Game loaded — ${gameState.scenario}`)
    }
    pendingGameAnnouncement.current = null
  }, [gameState?.session_id, gameState?.scenario, snackbar])

  function getScenarioTheme(scenario: string): number {
  const s = scenario?.toLowerCase() || ''
  if (s.includes('debt collector')) return 4  // crimson
  if (s.includes('lost heir') || s.includes('king')) return 1  // classic
  if (s.includes('cursed relic')) return 4  // crimson
  if (s.includes('assassin')) return 4  // crimson
  if (s.includes('grain') || s.includes('poison')) return 2  // forest
  if (s.includes('forgotten temple')) return 4  // crimson
  if (s.includes('veteran')) return 3  // ocean
  if (s.includes('double agent')) return 3  // ocean
  if (s.includes('beggar')) return 1  // classic
  if (s.includes('shipwreck')) return 3  // ocean
  if (s.includes('haunted')) return 4  // crimson
  if (s.includes('void') || s.includes('merchant') || s.includes('space')) return 5  // space
  return 1  // classic default
}

  useEffect(() => {
    if (gameState) {
      setIsLoadingGame(false)
      const activePlayer = gameState.players.find(p => p.name === gameState.active_player) ?? gameState.players[0]
      if (activePlayer?.battle_mode) {
        document.body.className = 'battle-mode'
      } else if (activePlayer?.romance_mode) {
        document.body.className = 'romance-mode'
      } else if (activePlayer?.win_mode) {
        document.body.className = 'win-mode'
      } else {
        const themeRule = gameState.settings?.common_rules?.find(r => r.label === 'Theme')
        if (themeRule) {
          const themeIdx = themeRule.current_level - 1
          document.body.className = ['theme-classic', 'theme-forest', 'theme-ocean', 'theme-crimson', 'theme-space'][themeIdx] || 'theme-classic'
        } else {
          const scenarioTheme = getScenarioTheme(gameState.scenario)
          document.body.className = ['theme-classic', 'theme-forest', 'theme-ocean', 'theme-crimson', 'theme-space'][scenarioTheme - 1] || 'theme-classic'
        }
      }
    }
  }, [gameState])

  useEffect(() => {
    if (showSplash && !loading) {
      const timer = setTimeout(() => {
        setShowSplash(false)
        setShowTitle(true)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [loading, showSplash])

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false)
    setShowTitle(true)
  }, [])

  useEffect(() => {
    const checkMobile = () => setIsMobileSize(window.innerWidth < MOBILE_BREAKPOINT)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!gameState) return
    const p = gameState.players.find(pl => pl.name === selectedPlayer) ?? gameState.players[0]
    if (p?.romance_mode) setMobileView('terminal')
    if (p?.win_mode) setMobileView('terminal')
  }, [gameState?.players, selectedPlayer])

  const handleGooglePlayLogin = useCallback((user: { id: string; name: string }) => {
    setGooglePlayUser(user)
    localStorage.setItem(GOOGLE_SESSION_KEY, JSON.stringify({ googlePlayUser: user, savedAt: new Date().toISOString() }))
  }, [])

  const handleGoogleLogout = useCallback(() => {
    setGooglePlayUser(null)
    localStorage.removeItem(GOOGLE_SESSION_KEY)
    const key = `ai_rpg_save_slot_${currentSlot}`
    localStorage.removeItem(key)
  }, [currentSlot])

  // Persists `gameState` into the active slot's localStorage entry.
  //
  // Critical race we have to defend against: when the player closes a slot
  // and clicks a *different* (empty) slot, `currentSlot` flips before the
  // backend has actually torn down the old session — `gameState` may still
  // hold the previous slot's data for a poll cycle or two. Without the guard
  // below, this effect would re-fire on the `currentSlot` change and write
  // the OLD gameState into the NEW slot's key, so the next time the player
  // viewed that "empty" slot it would surface the previous character.
  //
  // We track the last `(slot, session_id)` pair we actually persisted; if a
  // run finds the same `session_id` paired with a different slot than we
  // last saved, we treat it as stale carryover and skip the write. A genuine
  // new game brings a fresh `session_id`, which falls through and saves.
  const lastSavedSlotRef = useRef<{ slot: number; sessionId: string }>({ slot: -1, sessionId: '' })
  useEffect(() => {
    if (!gameState || !googlePlayUser) return
    const sessionId = gameState.session_id ?? ''
    if (
      lastSavedSlotRef.current.sessionId === sessionId &&
      lastSavedSlotRef.current.slot !== currentSlot
    ) {
      // Stale carryover — gameState still belongs to the previous slot.
      return
    }
    try {
      const key = `ai_rpg_save_slot_${currentSlot}`
      localStorage.setItem(key, JSON.stringify({
        googlePlayUser,
        gameState,
        savedAt: new Date().toISOString()
      }))
      lastSavedSlotRef.current = { slot: currentSlot, sessionId }
    } catch (e) {
      console.warn('Failed to save game', e)
    }
  }, [gameState, googlePlayUser, currentSlot])

  const handleSetupSubmit = useCallback(async (payload: SetupPayload) => {
    const key = `ai_rpg_save_slot_${currentSlot}_setup`
    localStorage.removeItem(key)
    pendingGameAnnouncement.current = 'started'
    await sendCommand(FAKE_SETUP_PLAYER, `__setup_complete__ ${JSON.stringify(payload)}`)
  }, [sendCommand, currentSlot])

  const handleSettingsApply = useCallback(async (update: { model?: string; common_rules?: Array<{ active: boolean; current_level: number }>; scenario_rules?: boolean[] }) => {
    if (update.common_rules) {
      // Locate the Theme rule by index in the authoritative settings list,
      // not by "first rule with current_level" — every rule has a numeric
      // current_level, so the old `find(r => r.current_level !== undefined)`
      // always matched the first rule and jammed the theme to whatever level
      // that rule happened to have (usually 1 = Classic).
      if (gameState?.settings?.common_rules) {
        const themeIdx = gameState.settings.common_rules.findIndex(r => r.label === 'Theme')
        if (themeIdx >= 0) {
          const newLevel = update.common_rules[themeIdx]?.current_level ?? 1
          const i = newLevel - 1
          document.body.className = ['theme-classic', 'theme-forest', 'theme-ocean', 'theme-crimson', 'theme-space'][i] || 'theme-classic'
        }
      }
      // Optimistic override for the color toggles so the highlight repaint is
      // instant; the round-trip will reconcile once gameState updates.
      if (gameState?.settings?.common_rules) {
        const charIdx = gameState.settings.common_rules.findIndex(r => r.label === 'Character Coloring')
        const locIdx  = gameState.settings.common_rules.findIndex(r => r.label === 'Location Coloring')
        const next: { character?: boolean; location?: boolean } = {}
        if (charIdx >= 0) next.character = update.common_rules[charIdx]?.active
        if (locIdx  >= 0) next.location  = update.common_rules[locIdx]?.active
        setColorOverrides(next)
      }
    }
    let normalizedUpdate = { ...update }
    if (update.model) {
      normalizedUpdate = { ...update, model: normalizeModel(update.model) }
    }
    const ok = await sendCommand(FAKE_SETUP_PLAYER, `__settings_update__ ${JSON.stringify(normalizedUpdate)}`)
    if (ok) {
      snackbar.success('Settings applied — the GM has been notified.')
    } else {
      snackbar.error('Could not apply settings — bridge server unreachable.')
    }
  }, [sendCommand, gameState, snackbar])

  // Surface backend errors as snackbar toasts so HF API errors (model_not_found,
  // rate-limit, etc.) are visible to the user instead of buried in the terminal.
  // We dedupe on the message so a 1.5s poll doesn't spam the same toast.
  const lastShownErrorRef = useRef<string>('')
  useEffect(() => {
    if (!error) { lastShownErrorRef.current = ''; return }
    if (error === lastShownErrorRef.current) return
    lastShownErrorRef.current = error
    let display = error.replace(/^\[RUST\]\s*\[ERROR\]\s*/i, '').trim()
    // Pull out a tighter message from JSON-shaped HF error bodies.
    const m = display.match(/"message":"([^"]+)"/)
    if (m) display = m[1]
    if (/model_not_found|does not exist/i.test(display)) {
      display = `${display} — try a different model from Settings.`
    }
    snackbar.error(display, 8000)
  }, [error, snackbar])

  // Once gameState reflects the requested values, drop the override so the
  // map doesn't grow stale.
  useEffect(() => {
    if (!gameState?.settings?.common_rules) return
    const charRule = gameState.settings.common_rules.find(r => r.label === 'Character Coloring')
    const locRule  = gameState.settings.common_rules.find(r => r.label === 'Location Coloring')
    setColorOverrides(prev => {
      const next = { ...prev }
      if (next.character !== undefined && charRule && next.character === charRule.active) delete next.character
      if (next.location  !== undefined && locRule  && next.location  === locRule.active)  delete next.location
      return next
    })
  }, [gameState])

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true)
  }, [])

  const handleTitle = useCallback(async () => {
    await sendCommand(FAKE_SETUP_PLAYER, 'title')
    setTimeout(() => {
      setShowTitle(true)
    }, 500)
  }, [sendCommand])

  const handleTitleFromSetup = useCallback(() => {
    setShowTitle(true)
  }, [])

  // Tracks the session_id we're currently shedding (after the player closes a
  // slot or starts a new one). While this is set, every render path that
  // would otherwise show the *previous* slot's game is blocked, so a click on
  // an empty slot can no longer flash the slot you just left before the
  // backend has caught up.
  const [staleSessionId, setStaleSessionId] = useState<string>('')
  useEffect(() => {
    if (!staleSessionId) return
    if (!gameState || gameState.session_id !== staleSessionId) {
      setStaleSessionId('')
    }
  }, [gameState, staleSessionId])

  const handleStartNew = useCallback((slot: number) => {
    setCurrentSlot(slot)
    setJustRestored(false)
    setIsLoadingGame(false)
    setStartNewGame(true)
    // Mark the current session as stale so the render path below doesn't
    // briefly show the previous slot's game while polling catches up.
    if (gameState?.session_id) setStaleSessionId(gameState.session_id)
    // Tell the Rust process to leave whatever game_loop it's in so it
    // re-enters the setup loop and writes a fresh `setup_state.json` for the
    // new slot. Without this the engine kept running the previous slot's
    // session in memory and re-emitted its game_state on the next tick,
    // which made an "empty" slot click reopen the slot we just left.
    void sendCommand(FAKE_SETUP_PLAYER, 'title').catch(() => {})
    fetch('/api/state', { method: 'DELETE' }).catch(() => {})
    // Clear any stale localStorage for this slot so old gameState that may
    // have been cross-saved from another slot doesn't reappear later.
    try { localStorage.removeItem(`ai_rpg_save_slot_${slot}`) } catch {}
    setShowTitle(false)
  }, [sendCommand, gameState])

  const handleDeleteSlot = useCallback(async (slot: number) => {
    const key = `ai_rpg_save_slot_${slot}`
    localStorage.removeItem(key)
    setStartNewGame(false)
    setShowTitle(true)
  }, [])

  const handleDeleteAllSlots = useCallback(async () => {
    try {
      await sendCommand(FAKE_SETUP_PLAYER, 'title').catch(() => {})
      for (let i = 1; i <= 4; i++) {
        const key = `ai_rpg_save_slot_${i}`
        localStorage.removeItem(key)
      }
      const res = await fetch('/api/state', { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error(`bridge returned ${res.status}`)
      setSelectedPlayer('')
      setJustRestored(false)
      setIsLoadingGame(false)
      setStartNewGame(false)
      setShowTitle(true)
      snackbar.success('All saves deleted.')
    } catch (e) {
      snackbar.error(`Could not delete all saves: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [sendCommand, snackbar])

  const handleDelete = useCallback(async () => {
    // Tell the running Rust process to leave its game loop and return to setup,
    // otherwise it will keep its in-memory state and re-write game_state.json
    // on the next turn — corrupting the next save.
    await sendCommand(FAKE_SETUP_PLAYER, 'title').catch(() => {})
    const key = `ai_rpg_save_slot_${currentSlot}`
    localStorage.removeItem(key)
    await fetch('/api/state', { method: 'DELETE' }).catch(() => {})
    setSelectedPlayer('')
    setJustRestored(false)
    setIsLoadingGame(false)
    setStartNewGame(false)
    setShowTitle(true)
  }, [currentSlot, sendCommand])

  const handleRestart = useCallback(async () => {
    if (!gameState) return
    const player = gameState.players.find(p => p.name === selectedPlayer) ?? gameState.players[0]
    if (player) {
      await sendCommand(player.name, 'restart')
      setSelectedPlayer('')
    }
  }, [sendCommand, gameState, selectedPlayer])

  // Clicking a quest step in the sidebar fires off two side-effects: ask the
  // AI for fresh suggestions tied to the current scene, and refresh the
  // character image so the art reflects the moment the player is dwelling on
  // a particular task. The actual image bump is handled inside CharacterPanel
  // via a window-scoped CustomEvent so we don't have to thread state through.
  const handleTaskClick = useCallback((_taskText: string) => {
    if (!gameState) return
    const player = gameState.players.find(p => p.name === selectedPlayer) ?? gameState.players[0]
    if (!player) return
    void sendCommand(player.name, 'assistant')
    window.dispatchEvent(new CustomEvent('refresh-character-image'))
  }, [sendCommand, gameState, selectedPlayer])

  // ── Splash: always show first when loading ──────────────────────────────────────────────
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  // ── Title screen ─────────────────────────────────────────────────────────────────
  if (showTitle) {
    return (
      <TitleScreen
        googlePlayUser={googlePlayUser}
        googleDisplayName={googlePlayUser?.name || 'Player'}
        onGooglePlayLogin={handleGooglePlayLogin}
        onGoogleLogout={handleGoogleLogout}
        onGuestPlay={() => {
          setShowTitle(false)
          setStartNewGame(true)
        }}
        onDeleteSlot={handleDeleteSlot}
        saveSlots={[1,2,3,4].map(slot => {
          let characterName: string | undefined
          let scenario: string | undefined
          let turn: number | undefined
          let themeColor: string | undefined
          try {
            const key = `ai_rpg_save_slot_${slot}`
            const saved = localStorage.getItem(key)
            if (saved) {
              const parsed = JSON.parse(saved)
              if (parsed.gameState) {
                characterName = parsed.gameState.players?.[0]?.name
                scenario = parsed.gameState.scenario
                turn = parsed.gameState.players?.[0]?.turn
                const s = scenario?.toLowerCase() || ''
                if (s.includes('debt collector')) themeColor = '#8e44ad'
                else if (s.includes('lost heir') || s.includes('king')) themeColor = '#d4af37'
                else if (s.includes('cursed relic')) themeColor = '#e74c3c'
                else if (s.includes('assassin')) themeColor = '#c0392b'
                else if (s.includes('grain') || s.includes('poison')) themeColor = '#27ae60'
                else if (s.includes('forgotten temple')) themeColor = '#9b59b6'
                else if (s.includes('veteran')) themeColor = '#2980b9'
                else if (s.includes('double agent')) themeColor = '#16a085'
                else if (s.includes('beggar')) themeColor = '#d4af37'
                else if (s.includes('shipwreck') || s.includes('obshore')) themeColor = '#1abc9c'
                else if (s.includes('haunted')) themeColor = '#8e44ad'
                else if (s.includes('void') || s.includes('merchant') || s.includes('space')) themeColor = '#6a5aaa'
                else themeColor = '#d4af37'
              }
            }
          } catch {}
          return {
            slot,
            hasData: (() => {
              try {
                const key = `ai_rpg_save_slot_${slot}`
                const saved = localStorage.getItem(key)
                if (saved) {
                  const parsed = JSON.parse(saved)
                  return !!parsed.gameState
                }
              } catch {}
              return false
            })(),
            characterName,
            scenario,
            turn,
            themeColor
          }
        })}
onLoadSlot={async (slot) => {
          setCurrentSlot(slot)
          setStartNewGame(false)
          pendingGameAnnouncement.current = 'loaded'
          try {
            const key = `ai_rpg_save_slot_${slot}`
            const saved = localStorage.getItem(key)
            if (saved) {
              const parsed = JSON.parse(saved)
              if (parsed.gameState) {
                await fetch('/api/restore', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ gameState: parsed.gameState })
                })
              }
            }
          } catch {}
          setShowTitle(false)
          setIsLoadingGame(true)
        }}
onStartNew={handleStartNew}
        onDeleteAllSlots={handleDeleteAllSlots}
      />
    )
  }

  // ── Show title screen before game starts if there's saved game but no active game ─
  if (!gameState && !setupState && !startNewGame) {
    return (
      <TitleScreen
        googlePlayUser={googlePlayUser}
        googleDisplayName={googlePlayUser?.name || 'Player'}
        onGooglePlayLogin={handleGooglePlayLogin}
        onGoogleLogout={handleGoogleLogout}
        onGuestPlay={() => { setShowTitle(false); setStartNewGame(true); }}
        saveSlots={[1,2,3,4].map(slot => {
          let characterName: string | undefined
          let scenario: string | undefined
          let turn: number | undefined
          let themeColor: string | undefined
          try {
            const key = `ai_rpg_save_slot_${slot}`
            const saved = localStorage.getItem(key)
            if (saved) {
              const parsed = JSON.parse(saved)
              if (parsed.gameState) {
                characterName = parsed.gameState.players?.[0]?.name
                scenario = parsed.gameState.scenario
                turn = parsed.gameState.players?.[0]?.turn
                const s = scenario?.toLowerCase() || ''
                if (s.includes('shattered') || s.includes('crown')) themeColor = '#d4af37'
                else if (s.includes('dragon') || s.includes('fire')) themeColor = '#e74c3c'
                else if (s.includes('shadow') || s.includes('dark')) themeColor = '#9b59b6'
                else if (s.includes('forest') || s.includes('elf')) themeColor = '#27ae60'
                else if (s.includes('ocean') || s.includes('sea')) themeColor = '#3498db'
                else if (s.includes('space') || s.includes('star')) themeColor = '#8e44ad'
                else if (s.includes('winter') || s.includes('ice')) themeColor = '#a8d5e5'
                else themeColor = '#d4af37'
              }
            }
          } catch {}
          return {
            slot,
            hasData: (() => {
              try {
                const key = `ai_rpg_save_slot_${slot}`
                const saved = localStorage.getItem(key)
                if (saved) {
                  const parsed = JSON.parse(saved)
                  return !!parsed.gameState
                }
              } catch {}
              return false
            })(),
            characterName,
            scenario,
            turn,
            themeColor
          }
        })}
        onLoadSlot={async (slot) => {
          setCurrentSlot(slot)
          setStartNewGame(false)
          pendingGameAnnouncement.current = 'loaded'
          try {
            const key = `ai_rpg_save_slot_${slot}`
            const saved = localStorage.getItem(key)
            if (saved) {
              const parsed = JSON.parse(saved)
              if (parsed.gameState) {
                await fetch('/api/restore', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ gameState: parsed.gameState })
                })
              }
            }
          } catch {}
          setShowTitle(false)
          setIsLoadingGame(true)
        }}
        onStartNew={handleStartNew}
        onDeleteAllSlots={handleDeleteAllSlots}
      />
    )
  }

  // ── Splash: waiting for Rust ──────────────────────────────────────────────
  if (loading && !setupState && !gameState) {
    return (
      <div className="splash">
        <div className="splash-inner">
          <div className="crown-glyph">♛</div>
          <h1 className="splash-title">AI RPG</h1>
          <p className="splash-sub">Waiting for game server…</p>
          <p className="splash-hint">Run <code>cargo run --release</code> in the project root.</p>
          {error && <p className="splash-error">{error}</p>}
          <button className="splash-continue-btn" onClick={() => window.location.reload()}>
            Continue existing game
          </button>
        </div>
      </div>
    )
  }

  // ── Setup wizard ──────────────────────────────────────────────────────────
  // Only show stepper if we haven't just restored a game, or if starting new game as guest
  // Don't show stepper when loading a save - wait for gameState to load from backend
  const hasSetupData = !!(setupState && setupState.phase === 'waiting' && setupState.data)
  // Treat the carryover session as if there were no game so the "previous slot"
  // never paints between handleStartNew and the next polling tick.
  const effectiveGameState = (staleSessionId && gameState?.session_id === staleSessionId) ? null : gameState
  const showSetupWizard = !justRestored && !effectiveGameState && (hasSetupData || startNewGame)
  if (showSetupWizard && setupState?.data) {
    return (
      <div className="setup-page">
        <SetupWizard data={setupState.data} onSubmit={handleSetupSubmit} onTitle={handleTitleFromSetup} />
      </div>
    )
  }

  // ── Generating (setup submitted, game not yet started) ────────────────────
  if (!effectiveGameState) {
    return (
      <div className="splash">
        <div className="splash-inner">
          <div className="crown-glyph">♛</div>
          <p className="splash-sub">Generating opening scenes…</p>
          <p className="splash-hint">This may take 30–60 seconds.</p>
          {error && <p className="splash-error">{error}</p>}
        </div>
      </div>
    )
  }

  const player = gameState.players.find(p => p.name === selectedPlayer) ?? gameState.players[0]
  if (!player) return null

  const currentTheme = gameState.settings?.common_rules?.find(r => r.label === 'Theme')?.current_level ?? 1
  const themeClass = ['theme-classic', 'theme-forest', 'theme-ocean', 'theme-crimson', 'theme-space'][currentTheme - 1] ?? 'theme-classic'
  let battleClass = ''
  if (player.battle_mode) battleClass = 'battle-mode'
  else if (player.romance_mode) battleClass = 'romance-mode'
  else if (player.win_mode) battleClass = 'win-mode'

  const ambientRadioEnabled = gameState.settings?.common_rules?.find(r => r.label === 'Ambient Radio')?.active ?? true
  const narrationEnabled = gameState.settings?.common_rules?.find(r => r.label === 'Narration Voice')?.active ?? true
  const characterColoringEnabled = colorOverrides.character ?? gameState.settings?.common_rules?.find(r => r.label === 'Character Coloring')?.active ?? false
  const locationColoringEnabled  = colorOverrides.location  ?? gameState.settings?.common_rules?.find(r => r.label === 'Location Coloring')?.active ?? false
  const showConsoleError = error && error.includes('[RUST]')

  return (
    <div className={`app ${themeClass} ${battleClass} ${isMobileSize ? 'has-mobile-nav' : ''}`}>
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-crown">♛</span>
          <span className="topbar-title">AI RPG</span>
          <span className="topbar-scenario">{gameState.scenario}</span>
        </div>
        <div className="topbar-right">
          <span className="topbar-model">{gameState.model}</span>
          <div className="topbar-zoom" title="Adjust text size">
            <button className="topbar-zoom-btn" onClick={zoomOut} disabled={uiZoom <= 0.7} title="Smaller text">−</button>
            <span className="topbar-zoom-val">{Math.round(uiZoom * 100)}%</span>
            <button className="topbar-zoom-btn" onClick={zoomIn}  disabled={uiZoom >= 1.5} title="Larger text">+</button>
          </div>
          <button className="settings-btn" onClick={() => setShowSettings(true)} title="Settings">⚙</button>
          <span className="topbar-pulse" title="Live" />
        </div>
      </header>

      {gameState.players.length > 1 && (
        <PlayerTabs players={gameState.players} activePlayer={gameState.active_player} selectedPlayer={player.name} onSelect={setSelectedPlayer} />
      )}

      <main
        className={`layout ${isMobileSize ? 'layout-mobile' : ''}`}
        style={!isMobileSize ? { gridTemplateColumns: `${leftPaneWidth}px 6px 1fr 6px ${rightPaneWidth}px` } : undefined}
      >
        {(isMobileSize && mobileView === 'quest') && (
          <aside className="col-left col-mobile">
            <QuestPanel mainQuest={gameState.main_quest} mainQuestSteps={gameState.main_quest_steps} mainQuestStepStatus={gameState.main_quest_step_status} sideQuests={gameState.side_quests} history={player.history.map(h => h.content)} onTaskClick={handleTaskClick} />
          </aside>
        )}
        {(isMobileSize && mobileView === 'terminal') && (
          <section className="col-center col-mobile">
<Terminal
              history={player.history} playerName={player.name}
              isActive={player.name === gameState.active_player}
              mainQuest={gameState.main_quest} sideQuests={gameState.side_quests}
              promptCount={player.prompt_count} totalChars={player.total_chars}
              inventory={player.inventory} sideCharacters={player.side_characters}
              locations={player.locations}
              characterColoringEnabled={characterColoringEnabled}
              locationColoringEnabled={locationColoringEnabled}
              sendCommand={sendCommand}
              onOpenSettings={handleOpenSettings}
              onTitle={handleTitle}
              onRestart={handleRestart}
              onDelete={handleDelete}
              isGameLoading={isLoadingGame}
              startTime={player.start_datetime}
              currentTime={player.current_datetime}
              endTime={player.end_datetime}
              currentNickname={player.current_nickname}
              nicknames={player.nicknames}
              assistantOptions={player.assistant_options}
            />
          </section>
        )}
        {!isMobileSize && (
          <>
            <aside className="col-left">
              <QuestPanel mainQuest={gameState.main_quest} mainQuestSteps={gameState.main_quest_steps} mainQuestStepStatus={gameState.main_quest_step_status} sideQuests={gameState.side_quests} history={player.history.map(h => h.content)} onTaskClick={handleTaskClick} />
            </aside>
            <div
              className="pane-resizer"
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize the quest panel"
              onPointerDown={(e) => startResize('left', e)}
            />
            <section className="col-center">
              <Terminal
                history={player.history} playerName={player.name}
                isActive={player.name === gameState.active_player}
                mainQuest={gameState.main_quest} sideQuests={gameState.side_quests}
                promptCount={player.prompt_count} totalChars={player.total_chars}
                inventory={player.inventory} sideCharacters={player.side_characters}
                locations={player.locations}
                characterColoringEnabled={characterColoringEnabled}
locationColoringEnabled={locationColoringEnabled}
              sendCommand={sendCommand}
              onOpenSettings={handleOpenSettings}
              onTitle={handleTitle}
              onRestart={handleRestart}
              onDelete={handleDelete}
              isGameLoading={isLoadingGame}
              startTime={player.start_datetime}
              currentTime={player.current_datetime}
                endTime={player.end_datetime}
                currentNickname={player.current_nickname}
                nicknames={player.nicknames}
              />
            </section>
            <div
              className="pane-resizer"
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize the character panel"
              onPointerDown={(e) => startResize('right', e)}
            />
            <aside className="col-right">
              <div className="col-right-content">
                <CharacterPanel player={player} seed={nameSeed(player.name)} service={imageService} sendCommand={sendCommand} />
              </div>
              {ambientRadioEnabled && gameState.scenario && (
                <AmbientRadio scenarioTitle={gameState.scenario} isBattle={player.battle_mode} isRomance={player.romance_mode} isWin={player.win_mode} />
              )}
              {narrationEnabled && (
                <Narrator enabled={narrationEnabled} lastGMRply={player.last_gm_reply} />
              )}
            </aside>
          </>
        )}
      </main>

      {isMobileSize && (
        <nav className="mobile-nav">
          <button className={`mobile-nav-btn ${mobileView === 'quest' ? 'active' : ''}`} onClick={() => setMobileView('quest')}>📜 Quests</button>
          <button className={`mobile-nav-btn ${mobileView === 'terminal' ? 'active' : ''}`} onClick={() => setMobileView('terminal')}>💬 Chat</button>
          <button className={`mobile-nav-btn ${mobileView === 'character' ? 'active' : ''}`} onClick={() => setMobileView('character')}>👤 Character</button>
        </nav>
      )}

      {/* Console error display - shows Rust errors in the terminal area */}
      {showConsoleError && (
        <div className="console-error">
          {error}
        </div>
      )}

      <footer className="statusbar">
        <span>Turn: <strong>{player.turn}</strong></span>
        <span>Prompts: <strong>{player.prompt_count}</strong></span>
        <span>Time: <strong>{player.current_datetime || '--'}</strong></span>
        <span className="statusbar-updated">{new Date(gameState.updated_at).toLocaleTimeString()}</span>
      </footer>

      {showSettings && gameState.settings && (
        <SettingsPanel
          settings={gameState.settings}
          models={models}
          imageService={imageService}
          onImageServiceChange={setImageService}
          onClose={() => setShowSettings(false)}
          onApply={handleSettingsApply}
        />
      )}

      {player.prompt_count === 0 && gameStartSplashDismissedFor !== gameState.session_id && (
        <GameStartSplash
          scenario={gameState.scenario}
          mainQuest={gameState.main_quest}
          characterName={player.name}
          onBegin={() => setGameStartSplashDismissedFor(gameState.session_id)}
          onPickMove={(move) => {
            setGameStartSplashDismissedFor(gameState.session_id)
            window.dispatchEvent(new CustomEvent('preload-terminal-input', { detail: { text: move } }))
          }}
        />
      )}
    </div>
  )
}

export function AppWrapper() {
  return (
    <SnackbarProvider>
      <MultiWindowGuard>
        <App />
      </MultiWindowGuard>
    </SnackbarProvider>
  )
}
