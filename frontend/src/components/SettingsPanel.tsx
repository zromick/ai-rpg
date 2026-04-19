// src/components/SettingsPanel.tsx
import { useState, useEffect } from 'react'
import type { GameSettings, CommonRuleSetting, ImageService } from '../types'
import { IMAGE_SERVICES } from '../imageServices'

interface Props {
  settings: GameSettings
  models: Array<{ label: string; id: string }>
  imageService: ImageService
  onImageServiceChange: (service: ImageService) => void
  onClose: () => void
  onApply: (update: { model?: string; common_rules?: Array<{ active: boolean; current_level: number }>; scenario_rules?: boolean[] }) => void
}

const UI_ONLY_RULES = ['Character Coloring', 'Location Coloring', 'Ambient Radio', 'Narration Voice', 'Theme', 'Time Travel']

export function SettingsPanel({ settings, models, imageService, onImageServiceChange, onClose, onApply }: Props) {
  const [model, setModel]           = useState(settings.model)
  const [rules, setRules]           = useState<CommonRuleSetting[]>(settings.common_rules.map(r => ({ ...r })))
  const [scenarioRules] = useState<boolean[]>(settings.scenario_rules.map(r => r.enabled))

  const aiPromptRules = rules.filter(r => !UI_ONLY_RULES.includes(r.label))
  const uiRules = rules.filter(r => UI_ONLY_RULES.includes(r.label))

  function handleApply() {
    onApply({ model, common_rules: rules.map(r => ({ active: r.active, current_level: r.current_level })), scenario_rules: scenarioRules })
    onClose()
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') handleApply()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="settings-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="settings-panel">
        <div className="settings-header">
          <span className="settings-title">⚙ Game Settings</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <h3 className="settings-section-title">Scenario</h3>
            <p className="settings-fixed">{settings.scenario_title}</p>
            <p className="settings-hint">Scenario cannot be changed mid-game. Type "title" to play a new game.</p>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">AI Model</h3>
            <select className="settings-select" value={model} onChange={e => setModel(e.target.value)}>
              {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <p className="settings-hint">Takes effect on the next GM response.</p>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">Image Engine</h3>
            <select className="settings-select" value={imageService.id} onChange={e => {
              const svc = IMAGE_SERVICES.find(s => s.id === e.target.value)
              if (svc) onImageServiceChange(svc)
            }}>
              {IMAGE_SERVICES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="settings-hint">{imageService.description}</p>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">AI Prompt Rules</h3>
            <p className="settings-hint">Rules that affect GM behavior and storytelling.</p>
            {aiPromptRules.length === 0 ? (
              <p className="settings-hint">No AI prompt rules defined.</p>
            ) : (
              aiPromptRules.map((r, i) => {
                const origIdx = rules.findIndex(rule => rule.label === r.label)
                return (
                  <div key={i} className="settings-rule">
                    {r.kind === 'boolean' ? (
                      <label className="settings-rule-label">
                        <input type="checkbox" className="setup-checkbox" checked={r.active}
                          onChange={e => { const n = [...rules]; n[origIdx] = { ...r, active: e.target.checked }; setRules(n); }}
                        />
                        <span className="settings-rule-name">{r.label}</span>
                      </label>
                    ) : (
                      <div className="settings-rule-level">
                        <span className="settings-rule-name">{r.label}</span>
                        <div className="setup-level-row">
                          <input type="range" min={r.label.includes('Difficulty') ? 1 : 0} max={r.max_level} value={r.current_level}
                            className="setup-slider"
                            onChange={e => { const lv = Number(e.target.value); const minLv = r.label.includes('Difficulty') ? 1 : 0; const n = [...rules]; n[origIdx] = { ...r, active: lv > 0, current_level: Math.max(minLv, lv) }; setRules(n); }}
                          />
                          <span className="setup-level-val">
                            {r.current_level === 0 ? 'OFF' : `${r.current_level} — ${r.level_names[r.current_level - 1] ?? '?'}`}
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="settings-rule-desc">{r.description}</p>
                  </div>
                )
              })
            )}
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">UI Rules</h3>
            <p className="settings-hint">Visual and audio interface options.</p>
            {uiRules.length === 0 ? (
              <p className="settings-hint">No UI rules defined.</p>
            ) : (
              uiRules.map((r, i) => {
                const origIdx = rules.findIndex(rule => rule.label === r.label)
                return (
                  <div key={i} className="settings-rule">
                    {r.label === 'Theme' ? (
                      <div className="settings-rule-level">
                        <span className="settings-rule-name">{r.label}</span>
                        <select className="settings-select" value={r.current_level}
                          onChange={e => { const lv = Number(e.target.value); const n = [...rules]; n[origIdx] = { ...r, active: lv > 0, current_level: lv }; setRules(n); }}
                        >
                          {r.level_names.map((ln, li) => (
                            <option key={li} value={li + 1}>{ln}</option>
                          ))}
                        </select>
                      </div>
                    ) : r.kind === 'boolean' ? (
                      <label className="settings-rule-label">
                        <input type="checkbox" className="setup-checkbox" checked={r.active}
                          onChange={e => { const n = [...rules]; n[origIdx] = { ...r, active: e.target.checked }; setRules(n); }}
                        />
                        <span className="settings-rule-name">{r.label}</span>
                      </label>
                    ) : (
                      <div className="settings-rule-level">
                        <span className="settings-rule-name">{r.label}</span>
                        <div className="setup-level-row">
                          <input type="range" min={r.label.includes('Difficulty') ? 1 : 0} max={r.max_level} value={r.current_level}
                            className="setup-slider"
                            onChange={e => { const lv = Number(e.target.value); const minLv = r.label.includes('Difficulty') ? 1 : 0; const n = [...rules]; n[origIdx] = { ...r, active: lv > 0, current_level: Math.max(minLv, lv) }; setRules(n); }}
                          />
                          <span className="setup-level-val">
                            {r.current_level === 0 ? 'OFF' : `${r.current_level} — ${r.level_names[r.current_level - 1] ?? '?'}`}
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="settings-rule-desc">{r.description}</p>
                  </div>
                )
              })
            )}
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">Scenario Rules</h3>
            {scenarioRules.length === 0 ? (
              <p className="settings-hint">No scenario-specific rules for this scenario.</p>
            ) : (
              scenarioRules.map((enabled, i) => (
                <div key={i} className="settings-rule">
                  <label className="settings-rule-label">
                    <input type="checkbox" className="setup-checkbox" checked={enabled} readOnly />
                    <span className="settings-rule-name">{settings.scenario_rules[i].label}</span>
                  </label>
                  <p className="settings-rule-desc">{settings.scenario_rules[i].description}</p>
                </div>
              ))
            )}
            <p className="settings-hint">Scenario rules cannot be changed mid-game.</p>
          </div>
        </div>

        <div className="settings-footer">
          <button className="setup-btn setup-btn--back" onClick={onClose}>Cancel</button>
          <button className="setup-btn setup-btn--start" onClick={handleApply}>✓ Apply &amp; Notify GM</button>
        </div>
      </div>
    </div>
  )
}
