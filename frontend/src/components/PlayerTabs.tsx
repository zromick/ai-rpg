// src/components/PlayerTabs.tsx
import type { PlayerState } from '../types'

interface Props {
  players: PlayerState[]
  activePlayer: string
  selectedPlayer: string
  onSelect: (name: string) => void
}

export function PlayerTabs({ players, activePlayer, selectedPlayer, onSelect }: Props) {
  return (
    <div className="player-tabs">
      {players.map(p => (
        <button
          key={p.name}
          className={[
            'player-tab',
            p.name === selectedPlayer ? 'player-tab--selected' : '',
            p.name === activePlayer   ? 'player-tab--active'   : '',
          ].filter(Boolean).join(' ')}
          onClick={() => onSelect(p.name)}
        >
          <span className="tab-name">{p.name}</span>
          {p.name === activePlayer && (
            <span className="tab-turn-indicator">↵ turn</span>
          )}
          <span className="tab-stats">
            {p.prompt_count} prompts · {p.total_chars} chars
          </span>
        </button>
      ))}
    </div>
  )
}
