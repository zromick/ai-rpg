// src/components/CharacterPanel.tsx
import { useState, useEffect, useMemo } from 'react'
import { useCharacterImage } from '../hooks/useCharacterImage'
import type { PlayerState, ImageService, InventoryItem, SideCharacter, Location } from '../types'

interface Props {
  player: PlayerState
  seed: number
  service: ImageService
  sendCommand?: (player: string, text: string) => Promise<boolean>
}

const CORE_FIELDS = [
  'age','gender','build','height','hair_color','hair_style',
  'eye_color','skin_tone','scars','clothing','expression','distinguishing',
  'current_location',
]

type FocusedEntity = { type: 'inventory'; item: InventoryItem } | { type: 'character'; char: SideCharacter } | { type: 'location'; loc: Location } | null

function buildEntityPrompt(entity: FocusedEntity): string {
  if (!entity) return ''
  if (entity.type === 'inventory') {
    const item = entity.item
    return `${item.name}, ${item.note || 'antique item'}, medieval fantasy item, detailed, antique, worn, dramatic lighting`
  }
  if (entity.type === 'character') {
    const c = entity.char
    return `${c.name}, ${c.description}, ${c.relation === 'player' ? 'player character' : c.relation}, medieval fantasy, dramatic portrait`
  }
  if (entity.type === 'location') {
    const l = entity.loc
    return `${l.name}, ${l.description}, medieval fantasy location, atmospheric, dramatic lighting`
  }
  return ''
}

export function CharacterPanel({ player, seed, service, sendCommand }: Props) {
  const { url } = useCharacterImage(player.image_prompt, player.last_gm_reply, seed, service)
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [activeTab, setActiveTab] = useState<'features' | 'inventory' | 'characters' | 'locations'>('features')
  const [focusedEntity, setFocusedEntity] = useState<FocusedEntity>(null)
  const [editMode, setEditMode] = useState(false)
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)

  const focusedPrompt = useMemo(() => buildEntityPrompt(focusedEntity), [focusedEntity])
  const { url: focusedUrl } = useCharacterImage(focusedPrompt, '', seed + 1, service)

  useEffect(() => { if (url) setImgState('loading') }, [url])
  useEffect(() => { if (focusedUrl) setImgState('loading') }, [focusedUrl])

  const displayUrl = focusedEntity ? focusedUrl : url
  const displayLabel = focusedEntity
    ? focusedEntity.type === 'inventory' ? focusedEntity.item.name
      : focusedEntity.type === 'character' ? focusedEntity.char.name
      : focusedEntity.type === 'location' ? focusedEntity.loc.name
      : ''
    : ''

  const clearFocus = () => setFocusedEntity(null)
  const custom = Object.entries(player.character_features).filter(([k]) => !CORE_FIELDS.includes(k))

  const hasPlayed = player && player.prompt_count > 0

  const startEditMode = () => {
    const initialFields: Record<string, string> = {}
    Object.entries(player.character_features).forEach(([k, v]) => {
      if (v && v !== 'none') initialFields[k] = v
    })
    setEditFields(initialFields)
    setEditMode(true)
  }

  const exitEditMode = () => {
    setEditMode(false)
    setEditFields({})
  }

  const updateField = (field: string, value: string) => {
    setEditFields(prev => ({ ...prev, [field]: value }))
  }

  const saveAndGenerate = async () => {
    if (!sendCommand) return
    setIsGenerating(true)
    const commands: string[] = []
    Object.entries(editFields).forEach(([field, value]) => {
      const originalValue = player.character_features[field]
      if (originalValue !== value) {
        commands.push(`set ${field} ${value}`)
      }
    })
    for (const cmd of commands) {
      await sendCommand(player.name, cmd)
    }
    exitEditMode()
    setIsGenerating(false)
  }

  return (
    <div className="char-panel">
      {/* ── Image ── */}
      <div className="char-image-wrap">
        {(!displayUrl || imgState === 'loading') && (
          <div className="char-image-placeholder">
            <span className="sigil">⚗</span>
            {displayUrl ? (
              <p>Generating scene…</p>
            ) : hasPlayed ? (
              <p>Generating image…</p>
            ) : (
              <p>Ready</p>
            )}
          </div>
        )}
        {imgState === 'error' && (
          <div className="char-image-placeholder error">
            <span className="sigil">✕</span>
            <p>Image failed — try a different engine</p>
          </div>
        )}
        {displayUrl && (
          <img
            key={displayUrl}
            src={displayUrl}
            alt={displayLabel || `${player.name} in action`}
            className="char-image"
            style={{ display: imgState === 'loaded' ? 'block' : 'none' }}
            onLoad={() => setImgState('loaded')}
            onError={() => setImgState('error')}
          />
        )}
        {focusedEntity && (
          <button className="char-image-clear" onClick={clearFocus} title="Clear focused item">
            ✕
          </button>
        )}
        {displayLabel && <span className="char-image-label">{displayLabel}</span>}
      </div>

      {/* ── Tab bar ── */}
      <div className="char-tabs">
        {(['features','inventory','characters','locations'] as const).map(tab => (
          <button
            key={tab}
            className={`char-tab ${activeTab === tab ? 'char-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {{ features:'👤', inventory:'🎒', characters:'👥', locations:'🗺' }[tab]}
            <span className="char-tab-label">{tab}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="char-tab-content">
        {activeTab === 'features' && (
          <>
            <div className="char-features-header">
              <span className="features-title">Character Features</span>
              {!editMode && (
                <button className="char-edit-btn" onClick={startEditMode} title="Edit Character">
                  ✎ Edit
                </button>
              )}
            </div>
            {editMode ? (
              <div className="char-edit-form">
                {CORE_FIELDS.filter(key => key !== 'current_location').map(key => (
                  <div key={key} className="char-edit-field">
                    <label className="char-edit-label">{key.replace('_', ' ')}</label>
                    <input
                      type="text"
                      className="char-edit-input"
                      value={editFields[key] ?? ''}
                      onChange={e => updateField(key, e.target.value)}
                      placeholder={player.character_features[key] || `Enter ${key.replace('_', ' ')}`}
                    />
                  </div>
                ))}
                {custom.map(([k, v]) => (
                  <div key={k} className="char-edit-field">
                    <label className="char-edit-label">{k.replace('_', ' ')}</label>
                    <input
                      type="text"
                      className="char-edit-input"
                      value={editFields[k] ?? ''}
                      onChange={e => updateField(k, e.target.value)}
                      placeholder={v}
                    />
                  </div>
                ))}
                <div className="char-edit-actions">
                  <button className="char-edit-cancel" onClick={exitEditMode}>
                    ✕ Cancel
                  </button>
                  <button className="char-edit-save" onClick={saveAndGenerate} disabled={isGenerating}>
                    {isGenerating ? '⟳ Generating...' : '✓ Save & Generate'}
                  </button>
                </div>
              </div>
            ) : (
              <table className="feature-table">
                <tbody>
                  {CORE_FIELDS.map(key => {
                    const val = player.character_features[key]
                    if (!val || val === 'none') return null
                    return (
                      <tr key={key}>
                        <td className="feat-key">{key.replace('_', ' ')}</td>
                        <td className="feat-val">{val}</td>
                      </tr>
                    )
                  })}
                  {custom.map(([k, v]) => (
                    <tr key={k} className="custom-row">
                      <td className="feat-key">{k.replace('_', ' ')}</td>
                      <td className="feat-val">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {activeTab === 'inventory' && (
          <div className="world-list">
            {player.inventory.length === 0
              ? <p className="world-empty">No items yet</p>
              : player.inventory.map((item, i) => (
                  <div key={i} className="world-item" onClick={() => setFocusedEntity({ type: 'inventory', item })}>
                    <span className="world-item-name">{item.name}</span>
                    <span className="world-item-qty">×{item.quantity}</span>
                    {item.note && <span className="world-item-note">{item.note}</span>}
                  </div>
                ))
            }
          </div>
        )}

        {activeTab === 'characters' && (
          <div className="world-list">
            {player.side_characters.length === 0
              ? <p className="world-empty">No characters met yet</p>
              : player.side_characters.map((c, i) => (
                  <div key={i} className="world-item world-item--char" onClick={() => setFocusedEntity({ type: 'character', char: c })}>
                    <div className="world-item-header">
                      <span className="world-item-name" data-status={c.outline_color ? 'custom' : c.relation} style={c.outline_color ? { borderBottomColor: c.outline_color } : undefined}>{c.name}</span>
                      <span className={`world-item-relation relation--${c.relation}`}>{c.relation}</span>
                    </div>
                    <span className="world-item-note">{c.description}</span>
                  </div>
                ))
            }
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="world-list">
            {player.locations.length === 0
              ? <p className="world-empty">No locations visited yet</p>
              : player.locations.map((l, i) => (
                  <div key={i} className="world-item world-item--loc" onClick={() => setFocusedEntity({ type: 'location', loc: l })}>
                    <div className="world-item-header">
                      <span className="world-item-name">{l.name}</span>
                      <span className="world-item-turn">turn {l.last_visited}</span>
                    </div>
                    <span className="world-item-note">{l.description}</span>
                  </div>
                ))
            }
          </div>
        )}
      </div>
    </div>
  )
}