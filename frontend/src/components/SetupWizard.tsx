// src/components/SetupWizard.tsx
//
// Single-step setup: name your characters and pick a scenario, then begin.
// Model, scenario rules, common rules, and the confirm step were intentionally
// dropped — those defaults are applied automatically and can still be edited
// in-game via the gear icon.

import { useState, useEffect } from 'react'
import type { SetupData, ScenarioOption } from '../types'

// Common-rule labels we surface as opt-in toggles directly inside the
// (now single-step) wizard. Everything else uses Rust-side defaults and
// remains editable via the in-game gear icon.
const WIZARD_TOGGLES = ['AI Assistant'] as const

const NAME_SETS: Record<string, string[]> = {
  crimson: [
    'Vladimir Bloodrose', 'Scara Nightshade', 'Morath the Dread', 'Lilith Darkholme', 'Dante Voidwalker',
    'Evangeline Roth', 'Caspian Shade', 'Nyx Blackthorn', 'Ravenna Graves', 'Mordred Sin'
  ],
  forest: [
    'Aeliana Greenleaf', 'Thornwood Cornbrush', 'Briar Mistwalker', 'Fern Grove', 'Oakheart Williams', 'Willowmere Delilah',
    'Sagebrush Measley', 'Mosswood Everstone', 'Rowan Branch', 'Bramble Freshwater'
  ],
  ocean: [
    'Marina Storms', 'Denton Wavecaller', 'Tidalyn Glass', 'Coralyx Minfell', 'Nerissa Tideborn',
    'Quintessa Current', 'Baylmore Ghastland', 'Mariner Salt', 'Pearlina Diver', 'Aqualine Jerodinn'
  ],
  classic: [
    'Aldric Shadowmere', 'Seraphina Blackwood', 'Kael Ironforge', 'Morgana Nightwind', 'Theron Silverbrook',
    'Elowen Stormcaller', 'Dorian Grayhaven', 'Isolde Fairweather', 'Ragnar Bloodaxe', 'Lyria Moonshadow'
  ],
  space: [
    'Zyx Voidwalker', 'Nebula Starborn', 'Orion Voidmere', 'Lyra Cosmicwind', 'Drax Shadowforge',
    'Celeste Nightstar', 'Kael Voidhaven', 'Iris Fairnebula', 'Ragnar Staraxe', 'Nova Moonwalker'
  ]
}

function getScenarioNames(template: number): string[] {
  if (template >= 2 && template <= 3) return NAME_SETS.ocean
  if (template === 4) return NAME_SETS.crimson
  if (template === 5) return NAME_SETS.space
  if (template === 8) return NAME_SETS.forest
  return NAME_SETS.classic
}

function rollRandomName(scenarioIdx: number): string {
  const names = getScenarioNames(scenarioIdx)
  return names[Math.floor(Math.random() * names.length)]
}

function getScenarioTheme(title: string): number {
  const s = (title || '').toLowerCase()
  if (s.includes('debt collector')) return 4
  if (s.includes('lost heir') || s.includes('king')) return 1
  if (s.includes('cursed relic')) return 4
  if (s.includes('assassin')) return 4
  if (s.includes('grain') || s.includes('poison')) return 2
  if (s.includes('forgotten temple')) return 4
  if (s.includes('veteran')) return 3
  if (s.includes('double agent')) return 3
  if (s.includes('beggar')) return 1
  if (s.includes('shipwreck')) return 3
  if (s.includes('haunted')) return 4
  if (s.includes('void') || s.includes('merchant') || s.includes('space')) return 5
  return 1
}

interface Props {
  data: SetupData
  onSubmit: (payload: SetupPayload) => void
  onTitle: () => void
}

export interface SetupPayload {
  model: string
  scenario_idx: number
  scenario_rules: boolean[]
  common_rules: Array<{ active: boolean; current_level: number }>
  players: Array<{ name: string }>
}

export function SetupWizard({ data, onSubmit, onTitle }: Props) {
  if (!data?.models?.length || !data?.common_rules?.length) {
    return (
      <div className="setup-page">
        <div className="setup-loading">
          <p>Loading setup data...</p>
          <button className="setup-back-btn" onClick={onTitle}>Back to Title</button>
        </div>
      </div>
    )
  }

  // Defaults that were previously toggleable in the wizard. These are applied
  // automatically on submit and remain editable from the in-game settings panel.
  const defaultModel = data.models[0]?.id ?? ''
  const [commonRules, setCommonRules] = useState<Array<{ active: boolean; current_level: number }>>(
    () => data.common_rules.map(r => ({ active: r.default_active, current_level: r.default_level })),
  )
  function toggleCommonRule(label: string, active: boolean) {
    const idx = data.common_rules.findIndex(r => r.label === label)
    if (idx < 0) return
    setCommonRules(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], active }
      return next
    })
  }
  function commonRuleActive(label: string): boolean {
    const idx = data.common_rules.findIndex(r => r.label === label)
    return idx >= 0 ? commonRules[idx]?.active ?? false : false
  }

  const [scenarioIdx, setScenarioIdx] = useState(0)
  const [playerCount, setPlayerCount] = useState(1)
  const [players, setPlayers] = useState<string[]>(() => [rollRandomName(0)])

  // Reroll the displayed default name(s) when the scenario changes — the name
  // pools differ per scenario theme, so a "Vladimir Bloodrose" suggestion
  // shouldn't linger when you switch to the forest scenario.
  useEffect(() => {
    setPlayers(prev => prev.map((n, i) => {
      // Only refresh names that are still empty or were auto-filled with a
      // pool name (i.e. unedited). Heuristic: if the existing name appears in
      // ANY of our pools, it was auto-suggested.
      const inPool = Object.values(NAME_SETS).some(set => set.includes(n))
      return (n.trim() === '' || inPool) ? rollRandomName(scenarioIdx) : n
    }))
  }, [scenarioIdx])

  // Match body class to scenario theme for live theming.
  useEffect(() => {
    const themeIdx = getScenarioTheme(data.scenarios[scenarioIdx]?.title ?? '')
    const themeClasses = ['theme-classic', 'theme-forest', 'theme-ocean', 'theme-crimson', 'theme-space']
    document.body.className = themeClasses[themeIdx - 1] || 'theme-classic'
  }, [scenarioIdx, data.scenarios])

  function setPlayerCountAdjusted(n: number) {
    setPlayerCount(n)
    setPlayers(prev => {
      const next = [...prev]
      while (next.length < n) next.push(rollRandomName(scenarioIdx))
      return next.slice(0, n)
    })
  }

  function rerollName(i: number) {
    setPlayers(prev => prev.map((n, idx) => idx === i ? rollRandomName(scenarioIdx) : n))
  }

  function handleSubmit() {
    const validPlayers = Array.from({ length: playerCount }).map((_, i) => {
      const name = (players[i] ?? '').trim()
      return { name: name || rollRandomName(scenarioIdx) }
    })
    const scenarioRulesDefaults = (data.scenarios[scenarioIdx]?.scenario_rules ?? [])
      .map(r => r.default)
    onSubmit({
      model: defaultModel,
      scenario_idx: scenarioIdx,
      scenario_rules: scenarioRulesDefaults,
      common_rules: commonRules,
      players: validPlayers,
    })
  }

  // Enter to begin once we're at the bottom of the form.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      const isInput = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
      if (e.key === 'Enter' && !isInput) {
        e.preventDefault()
        handleSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const scenario = data.scenarios[scenarioIdx]

  return (
    <div className="setup-wizard">
      <div className="setup-header">
        <button className="setup-back-btn" onClick={onTitle} title="Return to Title">←</button>
        <span className="setup-crown">♛</span>
        <span className="setup-title">AI RPG</span>
      </div>

      <div className="setup-body">
        <div className="setup-section">
          <h2 className="setup-section-title">Name Your Character{playerCount > 1 ? 's' : ''}</h2>
          <div className="setup-player-count">
            <span>Number of players:</span>
            <div className="setup-count-btns">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <button
                  key={n}
                  className={`setup-count-btn ${playerCount === n ? 'setup-count-btn--active' : ''}`}
                  onClick={() => setPlayerCountAdjusted(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {Array.from({ length: playerCount }).map((_, i) => (
            <div key={i} className="setup-player-row">
              <span className="setup-player-num">Player {i + 1}</span>
              <input
                className="setup-player-input"
                type="text"
                value={players[i] ?? ''}
                placeholder="Enter Name..."
                onChange={e => setPlayers(prev => {
                  const next = [...prev]
                  next[i] = e.target.value
                  return next
                })}
              />
              <button
                type="button"
                className="setup-reroll-btn"
                title="Roll a random name from this scenario's name pool"
                onClick={() => rerollName(i)}
              >
                🎲
              </button>
            </div>
          ))}
        </div>

        <div className="setup-section">
          <h2 className="setup-section-title">Select Your Scenario</h2>
          <div className="setup-list">
            {data.scenarios.map((s: ScenarioOption, i: number) => (
              <button
                key={i}
                className={`setup-item ${scenarioIdx === i ? 'setup-item--selected' : ''}`}
                onClick={() => setScenarioIdx(i)}
              >
                <span className="setup-item-label">{s.title}</span>
                <span className="setup-item-sub">{s.description}</span>
              </button>
            ))}
          </div>
          {scenario && (
            <div className="setup-preview">
              <div className="setup-preview-row">
                <span className="setup-preview-key">Win condition</span>
                <span>{scenario.win_conditions}</span>
              </div>
              <div className="setup-preview-row">
                <span className="setup-preview-key">Opening</span>
                <span className="setup-preview-val">{scenario.opening_scene.slice(0, 160)}…</span>
              </div>
              <div className="setup-preview-row">
                <span className="setup-preview-key">Start</span>
                <span>{scenario.user_condition}</span>
              </div>
              <div className="setup-preview-row">
                <span className="setup-preview-key">Inventory</span>
                <span>{scenario.user_inventory}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="setup-section">
        <h2 className="setup-section-title">Optional</h2>
        {WIZARD_TOGGLES.map(label => {
          const def = data.common_rules.find(r => r.label === label)
          if (!def) return null
          return (
            <label key={label} className="setup-rule-label">
              <input
                type="checkbox"
                className="setup-checkbox"
                checked={commonRuleActive(label)}
                onChange={e => toggleCommonRule(label, e.target.checked)}
              />
              <span className="setup-rule-name">{def.label}</span>
              <p className="setup-rule-desc">{def.description}</p>
            </label>
          )
        })}
      </div>

      <div className="setup-nav">
        <button className="setup-btn setup-btn--start" onClick={handleSubmit}>
          ♛ Begin Adventure (↵)
        </button>
      </div>
    </div>
  )
}
