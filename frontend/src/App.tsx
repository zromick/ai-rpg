import { useState, useEffect, useCallback } from 'react'
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
import { MultiWindowGuard } from './components/MultiWindowGuard'

const SAVE_SLOT_KEY = 'ai_rpg_save_slot_1'
const MOBILE_BREAKPOINT = 768

function nameSeed(name: string): number {
  let h = 0; for (const c of name) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0; return Math.abs(h)
}

const FAKE_SETUP_PLAYER = '__setup__'

export default function App() {
  const { gameState, setupState, error, loading, sendCommand } = useGameState()
  const [selectedPlayer, setSelectedPlayer]     = useState('')
  const [imageService, setImageService]     = useState<ImageService>(getService(DEFAULT_SERVICE_ID))
  const [showSettings, setShowSettings]     = useState(false)
  const [showSplash, setShowSplash] = useState(false)
  const [showTitle, setShowTitle] = useState(true)
  const [mobileView, setMobileView] = useState<'quest' | 'terminal' | 'character'>('terminal')
  const [isMobileSize, setIsMobileSize] = useState(false)
  const [currentSlot, setCurrentSlot] = useState(1)
  const [justRestored, setJustRestored] = useState(false)
  const [isLoadingGame, setIsLoadingGame] = useState(false)
  const [startNewGame, setStartNewGame] = useState(false)
  const [googlePlayUser, setGooglePlayUser] = useState<{ id: string; name: string } | null>(() => {
    try {
      const saved = localStorage.getItem(SAVE_SLOT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.googlePlayUser) return parsed.googlePlayUser
      }
    } catch {}
    return null
  })
const MODEL_BY_ID: Record<string, string> = {
    'meta-llama/llama-3.1-8b-instruct': 'meta-llama/Llama-3.1-8B-Instruct',
    'meta-llama/llama-3.1-8binstruct': 'meta-llama/Llama-3.1-8B-Instruct',
    'meta-llama/llama-3-1-8b-instruct': 'meta-llama/Llama-3.1-8B-Instruct',
    'google/gemma-2-9b-it': 'google/gemma-2-9b-it',
    'mistralai/mistral-7b-instruct-v0.3': 'mistralai/Mistral-7B-Instruct-v0.3',
    'mistralai/mistral-nemo-instruct-2407': 'mistralai/Mistral-Nemo-Instruct-2407',
    'huggingfaceh4/zephyr-7b-beta': 'HuggingFaceH4/zephyr-7b-beta',
    'nousresearch/hermes-3-llama-3.1-8b': 'NousResearch/Hermes-3-Llama-3.1-8B',
    'chaldene/llama-3.1-8b-instruct-abliterated': 'chaldene/Llama-3.1-8B-Instruct-Abliterated',
    'mistralai/mixtral-8x7b-instruct-v0.1': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    'microsoft/phi-3-medium-128k-instruct': 'microsoft/Phi-3-medium-128k-instruct',
  }

  const DEFAULT_MODEL_ID = 'meta-llama/Llama-3.1-8B-Instruct'
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
    { label:'Llama 3.1 8B Instruct (default)', id: DEFAULT_MODEL_ID },
    { label:'Gemma 2 9B IT',               id:'google/gemma-2-9b-it' },
    { label:'Mistral 7B v0.3',                 id:'mistralai/Mistral-7B-Instruct-v0.3' },
    { label:'Mistral Nemo 2407',              id:'mistralai/Mistral-Nemo-Instruct-2407' },
    { label:'Zephyr 7B Beta',                 id:'HuggingFaceH4/zephyr-7b-beta' },
    { label:'Hermes 3 Llama 3.1 8B',          id:'NousResearch/Hermes-3-Llama-3.1-8B' },
    { label:'Llama 3.1 8B Abliterated',      id:'chaldene/Llama-3.1-8B-Instruct-Abliterated' },
    { label:'Mixtral 8x7B',                   id:'mistralai/Mixtral-8x7B-Instruct-v0.1' },
    { label:'Phi-3 Medium 128k',            id:'microsoft/Phi-3-medium-128k-instruct' },
  ])

  useEffect(() => {
    if (gameState?.active_player) {
      setSelectedPlayer(prev => prev && gameState.players.find(p => p.name === prev) ? prev : gameState.active_player)
    }
  }, [gameState?.active_player])

  useEffect(() => {
    if (gameState && justRestored) {
      setJustRestored(false)
      setIsLoadingGame(false)
    }
  }, [gameState, justRestored])

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
    localStorage.setItem(SAVE_SLOT_KEY, JSON.stringify({ googlePlayUser: user, savedAt: new Date().toISOString() }))
  }, [])

  const handleGoogleLogout = useCallback(() => {
    setGooglePlayUser(null)
    localStorage.removeItem(SAVE_SLOT_KEY)
    const key = `ai_rpg_save_slot_${currentSlot}`
    localStorage.removeItem(key)
  }, [currentSlot])

  useEffect(() => {
    if (gameState && googlePlayUser) {
      try {
        const key = `ai_rpg_save_slot_${currentSlot}`
        localStorage.setItem(key, JSON.stringify({
          googlePlayUser,
          gameState,
          savedAt: new Date().toISOString()
        }))
      } catch (e) {
        console.warn('Failed to save game', e)
      }
    }
  }, [gameState, googlePlayUser, currentSlot])

  const handleSetupSubmit = useCallback(async (payload: SetupPayload) => {
    const key = `ai_rpg_save_slot_${currentSlot}_setup`
    localStorage.removeItem(key)
    await sendCommand(FAKE_SETUP_PLAYER, `__setup_complete__ ${JSON.stringify(payload)}`)
  }, [sendCommand, currentSlot])

  const handleSettingsApply = useCallback(async (update: { model?: string; common_rules?: Array<{ active: boolean; current_level: number }>; scenario_rules?: boolean[] }) => {
    if (update.common_rules) {
      const newThemeRule = update.common_rules.find(r => r.current_level !== undefined)
      if (newThemeRule) {
        const idx = newThemeRule.current_level - 1
        document.body.className = ['theme-classic', 'theme-forest', 'theme-ocean', 'theme-crimson', 'theme-space'][idx] || 'theme-classic'
      }
    }
    let normalizedUpdate = { ...update }
    if (update.model) {
      normalizedUpdate = { ...update, model: normalizeModel(update.model) }
    }
    await sendCommand(FAKE_SETUP_PLAYER, `__settings_update__ ${JSON.stringify(normalizedUpdate)}`)
  }, [sendCommand])

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

  const handleStartNew = useCallback((slot: number) => {
    setCurrentSlot(slot)
    setJustRestored(false)
    setIsLoadingGame(false)
    setStartNewGame(false)
    fetch('/api/state', { method: 'DELETE' }).catch(() => {})
    setShowTitle(false)
  }, [])

  const handleDeleteSlot = useCallback(async (slot: number) => {
    const key = `ai_rpg_save_slot_${slot}`
    localStorage.removeItem(key)
    setStartNewGame(false)
    setShowTitle(true)
  }, [])

  const handleDeleteAllSlots = useCallback(async () => {
    for (let i = 1; i <= 4; i++) {
      const key = `ai_rpg_save_slot_${i}`
      localStorage.removeItem(key)
    }
    fetch('/api/state', { method: 'DELETE' }).catch(() => {})
    setSelectedPlayer('')
    setJustRestored(false)
    setIsLoadingGame(false)
    setShowTitle(true)
  }, [])

  const handleDelete = useCallback(async () => {
    const key = `ai_rpg_save_slot_${currentSlot}`
    localStorage.removeItem(key)
    fetch('/api/state', { method: 'DELETE' }).catch(() => {})
    setSelectedPlayer('')
    setJustRestored(false)
    setIsLoadingGame(false)
    setShowTitle(true)
  }, [currentSlot])

  const handleRestart = useCallback(async () => {
    if (!gameState) return
    const player = gameState.players.find(p => p.name === selectedPlayer) ?? gameState.players[0]
    if (player) {
      await sendCommand(player.name, 'restart')
      setSelectedPlayer('')
    }
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
  const hasSetupData = setupState && setupState.phase === 'waiting' && setupState.data
  const showSetupWizard = !justRestored && !gameState && (hasSetupData || startNewGame)
  if (showSetupWizard) {
    return (
      <div className="setup-page">
        <SetupWizard data={hasSetupData ? setupState!.data : null} onSubmit={handleSetupSubmit} onTitle={handleTitleFromSetup} />
      </div>
    )
  }

  // ── Generating (setup submitted, game not yet started) ────────────────────
  if (!gameState) {
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
  const characterColoringEnabled = gameState.settings?.common_rules?.find(r => r.label === 'Character Coloring')?.active ?? false
  const locationColoringEnabled = gameState.settings?.common_rules?.find(r => r.label === 'Location Coloring')?.active ?? false
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
          <button className="settings-btn" onClick={() => setShowSettings(true)} title="Settings">⚙</button>
          <span className="topbar-pulse" title="Live" />
        </div>
      </header>

      {gameState.players.length > 1 && (
        <PlayerTabs players={gameState.players} activePlayer={gameState.active_player} selectedPlayer={player.name} onSelect={setSelectedPlayer} />
      )}

      <main className={`layout ${isMobileSize ? 'layout-mobile' : ''}`}>
        {(isMobileSize && mobileView === 'quest') && (
          <aside className="col-left col-mobile">
            <QuestPanel mainQuest={gameState.main_quest} mainQuestSteps={gameState.main_quest_steps} mainQuestStepStatus={gameState.main_quest_step_status} sideQuests={gameState.side_quests} history={player.history.map(h => h.content)} />
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
            />
          </section>
        )}
        {!isMobileSize && (
          <>
            <aside className="col-left">
              <QuestPanel mainQuest={gameState.main_quest} mainQuestSteps={gameState.main_quest_steps} mainQuestStepStatus={gameState.main_quest_step_status} sideQuests={gameState.side_quests} history={player.history.map(h => h.content)} />
            </aside>
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
    </div>
  )
}

export function AppWrapper() {
  return (
    <MultiWindowGuard>
      <App />
    </MultiWindowGuard>
  )
}
