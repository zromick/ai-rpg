import { useState, useEffect, useCallback } from 'react'
import { CharacterPanel } from './components/CharacterPanel'
import { Terminal } from './components/Terminal'
import { QuestPanel } from './components/QuestPanel'
import { PlayerTabs } from './components/PlayerTabs'
import { getService, DEFAULT_SERVICE_ID } from './imageServices'
import type { ImageService } from './types'
import { ServicePicker } from './components/ServicePicker'
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
    { label:'Llama 3.1 8B (default)', id:'meta-llama/Llama-3.1-8B-Instruct' },
    { label:'Llama 3.2 3B',           id:'meta-llama/Llama-3.2-3B-Instruct' },
    { label:'Gemma 2 9B',             id:'google/gemma-2-9b-it' },
    { label:'Mistral 7B v0.3',        id:'mistralai/Mistral-7B-Instruct-v0.3' },
    { label:'Mistral Nemo',           id:'mistralai/Mistral-Nemo-Instruct-2407' },
    { label:'Zephyr 7B',              id:'HuggingFaceH4/zephyr-7b-beta' },
    { label:'Hermes 3 Llama',         id:'NousResearch/Hermes-3-Llama-3.1-8B' },
    { label:'Llama Abliterated',      id:'chaldene/Llama-3.1-8B-Instruct-Abliterated' },
    { label:'Mixtral 8x7B',           id:'mistralai/Mixtral-8x7B-Instruct-v0.1' },
    { label:'Phi-3 Medium',           id:'microsoft/Phi-3-medium-128k-instruct' },
    { label:'Qwen 2.5 7B',            id:'Qwen/Qwen2.5-7B-Instruct' },
  ])

  useEffect(() => {
    if (gameState?.active_player) {
      setSelectedPlayer(prev => prev && gameState.players.find(p => p.name === prev) ? prev : gameState.active_player)
    }
  }, [gameState?.active_player])

  const handleSetupSubmit = useCallback(async (payload: SetupPayload) => {
    await sendCommand(FAKE_SETUP_PLAYER, `__setup_complete__ ${JSON.stringify(payload)}`)
  }, [sendCommand])

  const handleSettingsApply = useCallback(async (update: { model?: string; common_rules?: Array<{ active: boolean; current_level: number }> }) => {
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
          <h1 className="splash-title">Beggars to Crowns</h1>
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-crown">♛</span>
          <span className="topbar-title">Beggars to Crowns</span>
          <span className="topbar-scenario">{gameState.scenario}</span>
        </div>
        <div className="topbar-right">
          <ServicePicker selected={imageService} onSelect={setImageService} />
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
          <QuestPanel mainQuest={gameState.main_quest} mainQuestSteps={gameState.main_quest_steps} sideQuests={gameState.side_quests} scenario={gameState.scenario} history={player.history.map(h => h.content)} />
        </aside>
        <section className="col-center">
          <Terminal
            history={player.history} playerName={player.name}
            isActive={player.name === gameState.active_player}
            mainQuest={gameState.main_quest} sideQuests={gameState.side_quests}
            promptCount={player.prompt_count} totalChars={player.total_chars}
            inventory={player.inventory} sideCharacters={player.side_characters}
            locations={player.locations} sendCommand={sendCommand}
            onOpenSettings={() => setShowSettings(true)}
            onTitle={handleTitle}
            onRestart={handleRestart}
          />
        </section>
        <aside className="col-right">
          <CharacterPanel player={player} seed={nameSeed(player.name)} service={imageService} />
        </aside>
      </main>

      <footer className="statusbar">
        <span>Turn <strong>{player.turn}</strong></span>
        <span>Prompts: <strong>{player.prompt_count}</strong></span>
        <span className="statusbar-sep">│</span>
        <span>Active: <strong>{gameState.active_player}</strong></span>
        <span className="statusbar-sep">│</span>
        <span className="statusbar-updated">{new Date(gameState.updated_at).toLocaleTimeString()}</span>
      </footer>

      {showSettings && gameState.settings && (
        <SettingsPanel
          settings={gameState.settings}
          models={models}
          onClose={() => setShowSettings(false)}
          onApply={handleSettingsApply}
        />
      )}
    </div>
  )
}
