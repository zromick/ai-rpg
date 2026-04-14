// src/App.tsx
import { useState, useEffect } from 'react'
import { CharacterPanel } from './components/CharacterPanel'
import { Terminal } from './components/Terminal'
import { QuestPanel } from './components/QuestPanel'
import { PlayerTabs } from './components/PlayerTabs'
import { ServicePicker } from './components/ServicePicker'
import { getService, DEFAULT_SERVICE_ID } from './imageServices'
import type { ImageService } from './types'
import { useGameState } from './hooks/UseGameState'

function nameSeed(name: string): number {
  let h = 0
  for (const c of name) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

export default function App() {
  const { state, error, loading, sendCommand } = useGameState()
  const [selectedPlayer, setSelectedPlayer]    = useState<string>('')
  const [imageService, setImageService]        = useState<ImageService>(getService(DEFAULT_SERVICE_ID))

  useEffect(() => {
    if (state?.active_player) {
      setSelectedPlayer(prev =>
        prev && state.players.find(p => p.name === prev) ? prev : state.active_player
      )
    }
  }, [state?.active_player])

  // ── Splash ────────────────────────────────────────────────────────────────
  if (loading && !state) {
    return (
      <div className="splash">
        <div className="splash-inner">
          <div className="crown-glyph">♛</div>
          <h1 className="splash-title">Beggars to Crowns</h1>
          <p className="splash-sub">Waiting for the Rust game to start…</p>
          <p className="splash-hint">Run <code>cargo run --release</code> in the project root.</p>
          {error && <p className="splash-error">{error}</p>}
        </div>
      </div>
    )
  }

  if (error && !state) {
    return (
      <div className="splash">
        <div className="splash-inner">
          <div className="crown-glyph error">✕</div>
          <p className="splash-error">{error}</p>
          <p className="splash-hint">Is <code>npm run server</code> running?</p>
        </div>
      </div>
    )
  }

  if (!state) return null

  const player = state.players.find(p => p.name === selectedPlayer) ?? state.players[0]
  if (!player) return null

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-crown">♛</span>
          <span className="topbar-title">Beggars to Crowns</span>
          <span className="topbar-scenario">{state.scenario}</span>
        </div>
        <div className="topbar-right">
          <ServicePicker selected={imageService} onSelect={setImageService} />
          <span className="topbar-model">{state.model}</span>
          <span className="topbar-pulse" title="Live" />
        </div>
      </header>

      {state.players.length > 1 && (
        <PlayerTabs
          players={state.players}
          activePlayer={state.active_player}
          selectedPlayer={player.name}
          onSelect={setSelectedPlayer}
        />
      )}

      <main className="layout">
        <aside className="col-left">
          <QuestPanel
            mainQuest={state.main_quest}
            sideQuests={state.side_quests}
            scenario={state.scenario}
          />
        </aside>

        <section className="col-center">
          <Terminal
            history={player.history}
            playerName={player.name}
            isActive={player.name === state.active_player}
            mainQuest={state.main_quest}
            sideQuests={state.side_quests}
            promptCount={player.prompt_count}
            totalChars={player.total_chars}
            inventory={player.inventory}
            sideCharacters={player.side_characters}
            locations={player.locations}
            sendCommand={sendCommand}
          />
        </section>

        <aside className="col-right">
          <CharacterPanel player={player} seed={nameSeed(player.name)} service={imageService} />
        </aside>
      </main>

      <footer className="statusbar">
        <span>Turn <strong>{player.turn}</strong></span>
        <span>Prompts: <strong>{player.prompt_count}</strong></span>
        <span>Chars: <strong>{player.total_chars}</strong></span>
        <span className="statusbar-sep">│</span>
        <span>Active: <strong>{state.active_player}</strong></span>
        <span className="statusbar-sep">│</span>
        <span className="statusbar-updated">{new Date(state.updated_at).toLocaleTimeString()}</span>
      </footer>
    </div>
  )
}
