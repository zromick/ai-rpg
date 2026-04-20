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

function nameSeed(name: string): number {
  let h = 0; for (const c of name) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0; return Math.abs(h)
}

const FAKE_SETUP_PLAYER = '__setup__'

export default function App() {
  const { gameState, setupState, error, loading, sendCommand } = useGameState()
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [imageService, setImageService]     = useState<ImageService>(getService(DEFAULT_SERVICE_ID))
  const [showSettings, setShowSettings]     = useState(false)
const [models] = useState(() => [
    { label:'Llama 3.1 8B Instruct (default)', id:'meta-llama/Llama-3.1-8B-Instruct' },
    { label:'Llama 3.2 3B Instruct',         id:'meta-llama/Llama-3.2-3B-Instruct' },
    { label:'Gemma 2 9B IT',               id:'google/gemma-2-9b-it' },
    { label:'Mistral 7B v0.3',                 id:'mistralai/Mistral-7B-Instruct-v0.3' },
    { label:'Mistral Nemo 2407',              id:'mistralai/Mistral-Nemo-Instruct-2407' },
    { label:'Zephyr 7B Beta',                 id:'HuggingFaceH4/zephyr-7b-beta' },
    { label:'Hermes 3 Llama 3.1 8B',          id:'NousResearch/Hermes-3-Llama-3.1-8B' },
    { label:'Llama 3.1 8B Abliterated',      id:'chaldene/Llama-3.1-8B-Instruct-Abliterated' },
    { label:'Mixtral 8x7B',                   id:'mistralai/Mixtral-8x7B-Instruct-v0.1' },
    { label:'Phi-3 Medium 128k',            id:'microsoft/Phi-3-medium-128k-instruct' },
    { label:'Qwen 2.5 7B Instruct',           id:'Qwen/Qwen2.5-7B-Instruct' },
  ])

  useEffect(() => {
    if (gameState?.active_player) {
      setSelectedPlayer(prev => prev && gameState.players.find(p => p.name === prev) ? prev : gameState.active_player)
    }
  }, [gameState?.active_player])

  const handleSetupSubmit = useCallback(async (payload: SetupPayload) => {
    await sendCommand(FAKE_SETUP_PLAYER, `__setup_complete__ ${JSON.stringify(payload)}`)
  }, [sendCommand])

  const handleSettingsApply = useCallback(async (update: { model?: string; common_rules?: Array<{ active: boolean; current_level: number }>; scenario_rules?: boolean[] }) => {
    await sendCommand(FAKE_SETUP_PLAYER, `__settings_update__ ${JSON.stringify(update)}`)
  }, [sendCommand])

  const handleTitle = useCallback(async () => {
    await sendCommand(FAKE_SETUP_PLAYER, 'title')
  }, [sendCommand])

  const handleRestart = useCallback(async () => {
    if (!gameState) return
    const player = gameState.players.find(p => p.name === selectedPlayer) ?? gameState.players[0]
    if (player) await sendCommand(player.name, 'restart')
  }, [sendCommand, gameState, selectedPlayer])

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
        </div>
      </div>
    )
  }

  // ── Setup wizard ──────────────────────────────────────────────────────────
  if (!gameState && setupState?.phase === 'waiting' && setupState.data) {
    return (
      <div className="setup-page">
        <SetupWizard data={setupState.data} onSubmit={handleSetupSubmit} />
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

  const currentTheme = gameState.settings.common_rules.find(r => r.label === 'Theme')?.current_level ?? 1
  const themeClass = ['theme-classic', 'theme-forest', 'theme-ocean', 'theme-crimson'][currentTheme - 1] ?? 'theme-classic'

  const ambientRadioEnabled = gameState.settings?.common_rules?.find(r => r.label === 'Ambient Radio')?.active ?? true
  const narrationEnabled = gameState.settings?.common_rules?.find(r => r.label === 'Narration Voice')?.active ?? true
  const characterColoringEnabled = gameState.settings?.common_rules?.find(r => r.label === 'Character Coloring')?.active ?? false
  const locationColoringEnabled = gameState.settings?.common_rules?.find(r => r.label === 'Location Coloring')?.active ?? false
  const showConsoleError = error && error.includes('[RUST]')

  return (
    <div className={`app ${themeClass}`}>
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

      <main className="layout">
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
            onOpenSettings={() => setShowSettings(true)}
            onTitle={handleTitle}
            onRestart={handleRestart}
            startTime={player.start_datetime}
            currentTime={player.current_datetime}
            endTime={player.end_datetime}
            currentNickname={player.current_nickname}
            nicknames={player.nicknames}
          />
        </section>
        <aside className="col-right">
          <div className="col-right-content">
            <CharacterPanel player={player} seed={nameSeed(player.name)} service={imageService} />
          </div>
          {ambientRadioEnabled && gameState.scenario && (
            <AmbientRadio scenarioTitle={gameState.scenario} />
          )}
          {narrationEnabled && (
            <Narrator enabled={narrationEnabled} />
          )}
        </aside>
      </main>

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
