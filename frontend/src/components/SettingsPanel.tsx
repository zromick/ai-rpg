// src/components/SettingsPanel.tsx
import { useState } from 'react'
import type { GameSettings, CommonRuleSetting } from '../types'

interface Props {
  settings: GameSettings
  models: Array<{ label: string; id: string }>
  onClose: () => void
  onApply: (update: { model?: string; common_rules?: Array<{ active: boolean; current_level: number }> }) => void
}

export function SettingsPanel({ settings, models, onClose, onApply }: Props) {
  const [model, setModel]           = useState(settings.model)
  const [rules, setRules]           = useState<CommonRuleSetting[]>(settings.common_rules.map(r => ({ ...r })))

  function handleApply() {
    onApply({ model, common_rules: rules.map(r => ({ active: r.active, current_level: r.current_level })) })
    onClose()
  }

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
            <p className="settings-hint">Scenario cannot be changed mid-game. Use Title to restart.</p>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">AI Model</h3>
            <select className="settings-select" value={model} onChange={e => setModel(e.target.value)}>
              {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <p className="settings-hint">Takes effect on the next GM response.</p>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">Universal Rules</h3>
            {rules.map((r, i) => (
              <div key={i} className="settings-rule">
                {r.kind === 'boolean' ? (
                  <label className="settings-rule-label">
                    <input type="checkbox" className="setup-checkbox" checked={r.active}
                      onChange={e => { const n = [...rules]; n[i] = { ...r, active: e.target.checked }; setRules(n); }}
                    />
                    <span className="settings-rule-name">{r.label}</span>
                  </label>
                ) : (
                  <div className="settings-rule-level">
                    <span className="settings-rule-name">{r.label}</span>
                    <div className="setup-level-row">
                      <input type="range" min={0} max={r.max_level} value={r.current_level}
                        className="setup-slider"
                        onChange={e => { const lv = Number(e.target.value); const n = [...rules]; n[i] = { ...r, active: lv > 0, current_level: lv }; setRules(n); }}
                      />
                      <span className="setup-level-val">
                        {r.current_level === 0 ? 'OFF' : `${r.current_level} — ${r.level_names[r.current_level - 1] ?? '?'}`}
                      </span>
                    </div>
                  </div>
                )}
                <p className="settings-rule-desc">{r.description}</p>
              </div>
            ))}
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">Scenario Rules</h3>
            {settings.scenario_rules.map((r, i) => (
              <div key={i} className="settings-rule">
                <label className="settings-rule-label">
                  <input type="checkbox" className="setup-checkbox" checked={r.enabled} readOnly />
                  <span className="settings-rule-name">{r.label}</span>
                </label>
                <p className="settings-rule-desc">{r.description} <em>(set at game start — toggle via restart)</em></p>
              </div>
            ))}
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
