// src/components/GameStartSplash.tsx
//
// Shown once at the start of a fresh game (turn === 0). Shows the scenario,
// the main quest, a one-line "type any action" hint, and three suggested
// opening moves tailored to the active scenario.

interface Props {
  scenario: string
  mainQuest: string
  characterName: string
  onBegin: () => void
  /** Fires when the player clicks one of the suggested first moves. The
   *  parent should dismiss the splash and pre-fill the terminal input with
   *  the chosen move so the player can edit before sending. */
  onPickMove?: (move: string) => void
}

const GENERIC_FIRST_MOVES = [
  'Look around carefully and describe what you notice',
  'Check what you carry and what you\'re wearing',
  'Decide where you want to go first and start moving',
]

const SCENARIO_FIRST_MOVES: Array<{ match: RegExp; moves: string[] }> = [
  {
    match: /beggar|aethelgard|crown/i,
    moves: [
      'Approach the merchant guards by the gutter and beg for scraps',
      'Read the recruitment poster on the crumbling wall across the street',
      'Slip into the crowd and pickpocket someone for a few extra coppers',
    ],
  },
  {
    match: /shipwreck|obsidian|island/i,
    moves: [
      'Salvage what you can from the wreckage on the beach',
      'Find fresh water before the volcanic ash starts dehydrating you',
      'Climb a ridge and scout the coastline for tribal smoke or signal fires',
    ],
  },
  {
    match: /haunted|precinct|velmoor|detective/i,
    moves: [
      'Examine the photograph closely for marks, fibers, or hidden writing',
      'Visit the woman whose name and address are written in red ink',
      'Stop by the police precinct and ask why they stopped investigating',
    ],
  },
  {
    match: /void|merchant|kalveth|freighter|space|ship/i,
    moves: [
      'Address the crew on the bridge and take the captain\'s chair',
      'Plot a course through the debris field and chase the salvage rumor',
      'Open a channel with the creditor and try to negotiate the deadline',
    ],
  },
]

function suggestedFirstMoves(scenario: string): string[] {
  for (const { match, moves } of SCENARIO_FIRST_MOVES) {
    if (match.test(scenario)) return moves
  }
  return GENERIC_FIRST_MOVES
}

export function GameStartSplash({ scenario, mainQuest, characterName, onBegin, onPickMove }: Props) {
  const moves = suggestedFirstMoves(scenario)
  return (
    <div className="game-start-splash" onClick={onBegin}>
      <div className="game-start-splash-card" onClick={e => e.stopPropagation()}>
        <div className="game-start-splash-header">
          <span className="crown-glyph">♛</span>
          <h2 className="game-start-splash-scenario">{scenario}</h2>
          <p className="game-start-splash-name">You are {characterName}</p>
        </div>

        <section className="game-start-splash-section">
          <h3 className="game-start-splash-title">Main Quest</h3>
          <p className="game-start-splash-quest">{mainQuest}</p>
        </section>

        <section className="game-start-splash-section">
          <h3 className="game-start-splash-title">How to Play</h3>
          <p className="game-start-splash-howto">
            Type <em>any action</em> in the command box and press Enter — speak, look,
            move, fight, scheme. The Game Master will respond.
          </p>
        </section>

        <section className="game-start-splash-section">
          <h3 className="game-start-splash-title">Three Good First Moves</h3>
          <ul className="game-start-splash-moves">
            {moves.map((m, i) => (
              <li
                key={i}
                className={onPickMove ? 'game-start-splash-move--clickable' : undefined}
                onClick={onPickMove ? () => onPickMove(m) : undefined}
                role={onPickMove ? 'button' : undefined}
                tabIndex={onPickMove ? 0 : undefined}
                title={onPickMove ? 'Click to load this move into the command box' : undefined}
              >{m}</li>
            ))}
          </ul>
        </section>

        <button className="game-start-splash-begin" onClick={onBegin}>
          ♛ Begin Adventure
        </button>
        <p className="game-start-splash-skip">Click anywhere to dismiss</p>
      </div>
    </div>
  )
}
