// src/App.tsx
import { useState, useEffect } from 'react'
import { useGameState } from './hooks/useGameState'
import { CharacterPanel } from './components/CharacterPanel'
import { Terminal } from './components/Terminal'
import { QuestPanel } from './components/QuestPanel'
import { PlayerTabs } from './components/PlayerTabs'
import { ServicePicker } from './components/ServicePicker'
import { getService, DEFAULT_SERVICE_ID } from './imageServices'
import type { ImageService } from './types'

function nameSeed(name: string): number {
  let h = 0
  for (const c of name) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

export default function App() {
  const { state, error, loading } = useGameState()
  const [selectedPlayer, setSelectedPlayer] = useState<string>('')
  const [imageService, setImageService]     = useState<ImageService>(getService(DEFAULT_SERVICE_ID))

  useEffect(() => {
    if (state?.active_player) {
      setSelectedPlayer(prev =>
        prev && state.players.find(p => p.name === prev) ? prev : state.active_player
      )
    }
  }, [state?.active_player])

  // ── Splash: waiting for game ──────────────────────────────────────────────
  if (loading && !state) {
    return (
      <div className="splash">
        <div className="splash-inner">
          <div className="crown-glyph">♛</div>
          <h1 className="splash-title">Beggars to Crowns</h1>
          <p className="splash-sub">Waiting for the Rust game to start…</p>
          <p className="splash-hint">
            Run <code>cargo run --release</code> in the project root, then begin a game.
          </p>
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

  const seed = nameSeed(player.name)

  // onAction: the bridge server is read-only so we can't send commands from the
  // frontend to Rust. Instead we show a hint directing the user to the terminal.
  // If you later add a write endpoint to the bridge, wire it here.
  function handleAction(text: string) {
    console.info('[UI] Action submitted (use Rust terminal to advance game):', text)
    // No-op for now — the note in Terminal.tsx explains this limitation.
    // The input IS useful for local commands (quest, stats, etc.) which are
    // handled inside Terminal before this callback is reached.
  }

  return (
    <div className="app">
      {/* ── Topbar ── */}
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

      {/* ── Player tabs (multi-player only) ── */}
      {state.players.length > 1 && (
        <PlayerTabs
          players={state.players}
          activePlayer={state.active_player}
          selectedPlayer={player.name}
          onSelect={setSelectedPlayer}
        />
      )}

      {/* ── Three-column layout ── */}
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
            onAction={handleAction}
          />
        </section>

        <aside className="col-right">
          <CharacterPanel player={player} seed={seed} service={imageService} />
        </aside>
      </main>

      {/* ── Status bar ── */}
      <footer className="statusbar">
        <span>Prompts: <strong>{player.prompt_count}</strong></span>
        <span>Chars: <strong>{player.total_chars}</strong></span>
        <span className="statusbar-sep">│</span>
        <span>Active: <strong>{state.active_player}</strong></span>
        <span className="statusbar-sep">│</span>
        <span className="statusbar-updated">
          {new Date(state.updated_at).toLocaleTimeString()}
        </span>
      </footer>
    </div>
  )
}
