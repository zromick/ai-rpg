// src/components/SetupWizard.tsx
// Full game setup flow rendered as a terminal-style UI.
// Steps: model → scenario → scenario rules → universal rules → players → confirm

import { useState, useEffect } from 'react'
import type { SetupData, ModelOption, ScenarioOption, CommonRuleOption } from '../types'

const RANDOM_NAMES = [
  'Aldric Shadowmere', 'Seraphina Blackwood', 'Kael Ironforge', 'Morgana Nightwind', 'Theron Silverbrook',
  'Elowen Stormcaller', 'Dorian Grayhaven', 'Isolde Fairweather', 'Ragnar Bloodaxe', 'Lyria Moonshadow',
  'Cedric Wildwood', 'Astrid Frostborn', 'Gareth Stonewall', 'Rowena Goldheart', 'Finn Blackthorn',
  'Cora Brightblade', 'Borian Stormwarden', 'Mirabel Windrider', 'Axel Darkwater', 'Sylas Redmantle'
]

function getRandomName(): string {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
}

interface Props {
  data: SetupData
  onSubmit: (payload: SetupPayload) => void
}

export interface SetupPayload {
  model: string
  scenario_idx: number
  scenario_rules: boolean[]
  common_rules: Array<{ active: boolean; current_level: number }>
  players: Array<{ name: string }>
}

type Step = 'model' | 'scenario' | 'scenario_rules' | 'common_rules' | 'players' | 'confirm'

export function SetupWizard({ data, onSubmit }: Props) {
  const SETUP_UI_RULES = ['Character Coloring', 'Location Coloring', 'Ambient Radio', 'Narration Voice', 'Theme', 'Time Travel']

  const [step, setStep]                 = useState<Step>('model')
  const [model, setModel]               = useState(data.models[0]?.id ?? '')
  const [scenarioIdx, setScenarioIdx]   = useState(0)
  const [scenarioRules, setScenarioRules] = useState<boolean[]>([])
  const [commonRules, setCommonRules]   = useState<Array<{ active: boolean; current_level: number }>>(
    data.common_rules.map(r => ({ active: r.default_active, current_level: r.default_level }))
  )
  const [players, setPlayers]           = useState<string[]>([''])
  const [playerCount, setPlayerCount]   = useState(1)

  function goNext() {
    if (step === 'model')          setStep('scenario')
    else if (step === 'scenario') {
      const sc = data.scenarios[scenarioIdx]
      setScenarioRules(sc.scenario_rules.map(r => r.default))
      setStep('scenario_rules')
    }
    else if (step === 'scenario_rules') setStep('common_rules')
    else if (step === 'common_rules')   setStep('players')
    else if (step === 'players')        setStep('confirm')
  }

  function goBack() {
    if (step === 'scenario') setStep('model')
    else if (step === 'scenario_rules') setStep('scenario')
    else if (step === 'common_rules')   setStep('scenario_rules')
    else if (step === 'players')        setStep('common_rules')
    else if (step === 'confirm')        setStep('players')
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      const isInput = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
      if (!isInput) {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (step === 'confirm') handleSubmit()
          else goNext()
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          if (step !== 'model') goBack()
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          if (step === 'confirm') handleSubmit()
          else goNext()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [step, model, scenarioIdx, scenarioRules])

function handleSubmit() {
    const validPlayers = players.slice(0, playerCount).map((n, i) => {
      const name = n.trim()
      return name ? { name } : { name: i === 0 && !n ? getRandomName() : 'Unnamed Hero' }
    })
    onSubmit({ model, scenario_idx: scenarioIdx, scenario_rules: scenarioRules, common_rules: commonRules, players: validPlayers })
  }

  const scenario = data.scenarios[scenarioIdx]
  const steps: Step[] = ['model','scenario','scenario_rules','common_rules','players','confirm']
  const stepNum = steps.indexOf(step) + 1

  return (
    <div className="setup-wizard">
      <div className="setup-header">
        <span className="setup-crown">♛</span>
        <span className="setup-title">AI RPG</span>
        <span className="setup-step">Setup {stepNum} / {steps.length}</span>
      </div>

      <div className="setup-progress">
        {steps.map((s, i) => (
          <div key={s} className={`setup-pip ${steps.indexOf(step) >= i ? 'setup-pip--done' : ''}`} />
        ))}
      </div>

      <div className="setup-body">

        {/* ── Model ── */}
        {step === 'model' && (
          <div className="setup-section">
            <h2 className="setup-section-title">Select AI Model</h2>
            <p className="setup-section-hint">The GM (Game Master) model. Larger models give better storytelling.</p>
            <div className="setup-list">
              {data.models.map((m: ModelOption) => (
                <button key={m.id} className={`setup-item ${model === m.id ? 'setup-item--selected' : ''}`} onClick={() => setModel(m.id)}>
                  <span className="setup-item-label">{m.label}</span>
                  <span className="setup-item-sub">{m.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Scenario ── */}
        {step === 'scenario' && (
          <div className="setup-section">
            <h2 className="setup-section-title">Select Scenario</h2>
            <div className="setup-list">
              {data.scenarios.map((s: ScenarioOption, i: number) => (
                <button key={i} className={`setup-item ${scenarioIdx === i ? 'setup-item--selected' : ''}`} onClick={() => setScenarioIdx(i)}>
                  <span className="setup-item-label">{s.title}</span>
                  <span className="setup-item-sub">{s.description}</span>
                </button>
              ))}
            </div>
            {scenario && (
              <div className="setup-preview">
                <div className="setup-preview-row"><span className="setup-preview-key">Win condition</span><span>{scenario.win_conditions}</span></div>
                <div className="setup-preview-row"><span className="setup-preview-key">Opening</span><span className="setup-preview-val">{scenario.opening_scene.slice(0, 160)}…</span></div>
                <div className="setup-preview-row"><span className="setup-preview-key">Start</span><span>{scenario.user_condition}</span></div>
                <div className="setup-preview-row"><span className="setup-preview-key">Inventory</span><span>{scenario.user_inventory}</span></div>
              </div>
            )}
          </div>
        )}

        {/* ── Scenario rules ── */}
        {step === 'scenario_rules' && scenario && (
          <div className="setup-section">
            <h2 className="setup-section-title">Scenario Rules — {scenario.title}</h2>
            <p className="setup-section-hint">These rules shape how this specific scenario plays out.</p>
            {scenario.scenario_rules.length === 0
              ? <p className="setup-none">No scenario-specific rules for this scenario.</p>
              : scenario.scenario_rules.map((r, i) => (
                  <div key={i} className="setup-rule">
                    <label className="setup-rule-label">
                      <input type="checkbox" className="setup-checkbox"
                        checked={scenarioRules[i] ?? r.default}
                        onChange={e => { const n = [...scenarioRules]; n[i] = e.target.checked; setScenarioRules(n); }}
                      />
                      <span className="setup-rule-name">{r.label}</span>
                    </label>
                    <p className="setup-rule-desc">{r.description}</p>
                  </div>
                ))
            }
          </div>
        )}

        {/* ── Common rules ── */}
        {step === 'common_rules' && (
          <div className="setup-section">
            <h2 className="setup-section-title">AI Prompt Rules</h2>
            <p className="setup-section-hint">Rules that affect GM behavior and storytelling.</p>
            {data.common_rules.filter(r => !SETUP_UI_RULES.includes(r.label)).map((r: CommonRuleOption, i: number) => {
              const origIdx = data.common_rules.findIndex(ar => ar.label === r.label)
              const cr = commonRules[origIdx] ?? { active: r.default_active, current_level: r.default_level }
              return (
                <div key={i} className="setup-rule">
                  {r.kind === 'boolean' ? (
                    <label className="setup-rule-label">
                      <input type="checkbox" className="setup-checkbox"
                        checked={cr.active}
                        onChange={e => { const n = [...commonRules]; n[origIdx] = { ...cr, active: e.target.checked }; setCommonRules(n); }}
                      />
                      <span className="setup-rule-name">{r.label}</span>
                    </label>
                  ) : (
                    <div className="setup-rule-level">
                      <span className="setup-rule-name">{r.label}</span>
                      <div className="setup-level-row">
                        <input type="range" min={r.label.includes('Difficulty') || r.label.includes('Side Quests') || r.label.includes('Response') ? 1 : 0} max={r.max_level} value={cr.current_level}
                          className="setup-slider"
                          onChange={e => { const lv = Number(e.target.value); const minLv = r.label.includes('Difficulty') || r.label.includes('Side Quests') || r.label.includes('Response') ? 1 : 0; const n = [...commonRules]; n[origIdx] = { active: lv > 0, current_level: Math.max(minLv, lv) }; setCommonRules(n); }}
                        />
                        <span className="setup-level-val">
                          {cr.current_level === 0 ? 'OFF' : `${cr.current_level} — ${r.level_names[cr.current_level - 1] ?? '?'}`}
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="setup-rule-desc">{r.description}</p>
                </div>
              )
            })}
          </div>
        )}

        {step === 'common_rules' && (
          <div className="setup-section">
            <h2 className="setup-section-title">UI Rules</h2>
            <p className="setup-section-hint">Visual and audio interface options.</p>
            {data.common_rules.filter(r => SETUP_UI_RULES.includes(r.label)).map((r: CommonRuleOption, i: number) => {
              const origIdx = data.common_rules.findIndex(ar => ar.label === r.label)
              const cr = commonRules[origIdx] ?? { active: r.default_active, current_level: r.default_level }
              return (
                <div key={i} className="setup-rule">
                  {r.label === 'Theme' ? (
                    <div className="settings-rule-level">
                      <span className="settings-rule-name">{r.label}</span>
                      <select className="settings-select" value={cr.current_level}
                        onChange={e => { const lv = Number(e.target.value); const n = [...commonRules]; n[origIdx] = { active: lv > 0, current_level: lv }; setCommonRules(n); }}
                      >
                        {r.level_names.map((ln, li) => (
                          <option key={li} value={li + 1}>{ln}</option>
                        ))}
                      </select>
                    </div>
                  ) : r.kind === 'boolean' ? (
                    <label className="setup-rule-label">
                      <input type="checkbox" className="setup-checkbox"
                        checked={cr.active}
                        onChange={e => { const n = [...commonRules]; n[origIdx] = { ...cr, active: e.target.checked }; setCommonRules(n); }}
                      />
                      <span className="setup-rule-name">{r.label}</span>
                    </label>
                  ) : (
                    <div className="setup-rule-level">
                      <span className="setup-rule-name">{r.label}</span>
                      <div className="setup-level-row">
                        <input type="range" min={1} max={r.max_level} value={cr.current_level}
                          className="setup-slider"
                          onChange={e => { const lv = Number(e.target.value); const n = [...commonRules]; n[origIdx] = { active: lv > 0, current_level: lv }; setCommonRules(n); }}
                        />
                        <span className="setup-level-val">
                          {cr.current_level === 0 ? 'OFF' : `${cr.current_level} — ${r.level_names[cr.current_level - 1] ?? '?'}`}
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="setup-rule-desc">{r.description}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Players ── */}
        {step === 'players' && (
          <div className="setup-section">
            <h2 className="setup-section-title">Players</h2>
            <div className="setup-player-count">
              <span>Number of players:</span>
              <div className="setup-count-btns">
                {[1,2,3,4,5,6,7,8].map(n => (
                  <button key={n} className={`setup-count-btn ${playerCount === n ? 'setup-count-btn--active' : ''}`}
                    onClick={() => { setPlayerCount(n); setPlayers(prev => { const a = [...prev]; while (a.length < n) a.push(''); return a; }); }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {Array.from({ length: playerCount }).map((_, i) => (
              <div key={i} className="setup-player-row">
                <span className="setup-player-num">Player {i+1}</span>
                <input className="setup-player-input" type="text"
                  value={players[i] ?? ''}
                  placeholder="Enter Name..."
                  onChange={e => { const n = [...players]; n[i] = e.target.value; setPlayers(n); }}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Confirm ── */}
        {step === 'confirm' && (
          <div className="setup-section">
            <h2 className="setup-section-title">Ready to Begin</h2>
            <div className="setup-summary">
              <div className="setup-sum-row"><span className="setup-sum-key">Model</span><span>{data.models.find(m => m.id === model)?.label ?? model}</span></div>
              <div className="setup-sum-row"><span className="setup-sum-key">Scenario</span><span>{data.scenarios[scenarioIdx]?.title}</span></div>
              <div className="setup-sum-row"><span className="setup-sum-key">Players</span><span>{players.slice(0, playerCount).map((n, i) => n.trim() || (i === 0 ? getRandomName() : 'Unnamed Hero')).join(', ')}</span></div>
              <div className="setup-sum-row"><span className="setup-sum-key">Difficulty</span>
                <span>{(() => { const dr = commonRules[data.common_rules.findIndex(r => r.label.includes('Difficulty'))]; return dr ? (dr.active ? `${dr.current_level} — ${data.common_rules.find(r => r.label.includes('Difficulty'))?.level_names[dr.current_level-1] ?? '?'}` : 'OFF') : '—'; })()}</span>
              </div>
              <div className="setup-sum-row"><span className="setup-sum-key">Side Quests</span>
                <span>{(() => { const sq = commonRules[data.common_rules.findIndex(r => r.label === 'Side Quests')]; return sq?.active ? `${sq.current_level} quest(s)` : 'None'; })()}</span>
              </div>
            </div>
            <p className="setup-section-hint">Opening scenes will be generated after you click Start. This may take 30–60 seconds.</p>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <div className="setup-nav">
        {step !== 'model' && <button className="setup-btn setup-btn--back" onClick={goBack}>Back (←)</button>}
        {step !== 'confirm'
          ? <button className="setup-btn setup-btn--next" onClick={goNext}>Next (→ / ↵)</button>
          : <button className="setup-btn setup-btn--start" onClick={handleSubmit}>♛ Begin Adventure (→ / ↵)</button>
        }
      </div>
    </div>
  )
}
