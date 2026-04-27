// src/components/CharacterPanel.tsx
import { useState, useEffect, useMemo, useRef } from 'react'
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

// Build the richest prompt we can from the structured data the GM extraction
// produced. Features (build, age, clothing, mood, exterior, etc.) are flattened
// into the prompt so the image model has concrete visual cues, not just a name.
function flattenFeatures(features?: Record<string, string>): string {
  if (!features) return ''
  return Object.entries(features)
    .filter(([_, v]) => v && v !== 'none' && v !== 'null')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(', ')
}

function buildEntityPrompt(entity: FocusedEntity): string {
  if (!entity) return ''
  if (entity.type === 'inventory') {
    const item = entity.item
    const detail = item.note || 'antique item'
    return `${item.name}, ${detail}, quantity ${item.quantity}, medieval fantasy item, detailed, antique, worn, dramatic lighting`
  }
  if (entity.type === 'character') {
    const c = entity.char
    const features = flattenFeatures(c.character_features)
    const role = c.relation === 'player' ? 'player character' : c.relation
    return [
      c.name,
      c.description,
      features,
      role,
      'medieval fantasy, dramatic portrait, detailed face',
    ].filter(Boolean).join(', ')
  }
  if (entity.type === 'location') {
    const l = entity.loc
    const features = flattenFeatures(l.location_features)
    return [
      l.name,
      l.description,
      features,
      'medieval fantasy location, environment shot, atmospheric, dramatic lighting',
    ].filter(Boolean).join(', ')
  }
  return ''
}

export function CharacterPanel({ player, seed, service, sendCommand }: Props) {
  // Quest-step clicks dispatch a window-scoped 'refresh-character-image' event
  // that bumps this counter; mixing it into the seed forces useCharacterImage
  // to re-fetch even when image_prompt and last_gm_reply are unchanged.
  const [imgRefreshNonce, setImgRefreshNonce] = useState(0)
  useEffect(() => {
    const onRefresh = () => setImgRefreshNonce(n => n + 1)
    window.addEventListener('refresh-character-image', onRefresh as EventListener)
    return () => window.removeEventListener('refresh-character-image', onRefresh as EventListener)
  }, [])
  const { url } = useCharacterImage(player.image_prompt, player.last_gm_reply, seed + imgRefreshNonce, service)
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [activeTab, setActiveTab] = useState<'features' | 'inventory' | 'characters' | 'locations'>('features')
  const [focusedEntity, setFocusedEntity] = useState<FocusedEntity>(null)
  const [editMode, setEditMode] = useState(false)
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)

  const focusedPrompt = useMemo(() => buildEntityPrompt(focusedEntity), [focusedEntity])
  // Click counter — bumped on every click, even if the same entity is clicked
  // twice. Used as part of the image seed so the user always sees a fresh
  // generation instead of a cached identical prompt → identical image.
  const [focusClicks, setFocusClicks] = useState(0)
  const { url: focusedUrl } = useCharacterImage(focusedPrompt, '', seed + 1 + focusClicks, service)

  useEffect(() => { if (url) setImgState('loading') }, [url])
  useEffect(() => { if (focusedUrl) setImgState('loading') }, [focusedUrl])

  // Listen for click-to-focus events dispatched by the Terminal's highlights.
  // Routing is keyed on the `kind` we tagged at highlight build time, so a
  // character with the same word in their name as a location no longer
  // misroutes the click.
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = panelRef.current
    if (!node) return
    const onFocus = (e: Event) => {
      const detail = (e as CustomEvent<{ kind: 'character' | 'location'; name: string }>).detail
      if (!detail) return
      const lower = detail.name.toLowerCase()
      if (detail.kind === 'character') {
        setActiveTab('characters')
        const match = player.side_characters.find(c =>
          c.name.toLowerCase() === lower ||
          c.name.toLowerCase().split(/\s+/).includes(lower)
        )
        if (match) {
          setFocusedEntity({ type: 'character', char: match })
        } else {
          // No exact match in side_characters (the entity may have been
          // filtered out, or the GM mentioned someone we haven't tracked yet).
          // Synthesise a minimal record so the player still gets a fresh
          // image rather than nothing.
          setFocusedEntity({ type: 'character', char: {
            name: detail.name, description: detail.name, relation: 'unknown',
            outline_color: undefined, character_features: undefined, inventory: undefined,
          } as SideCharacter })
        }
        setFocusClicks(c => c + 1)
      } else {
        setActiveTab('locations')
        const match = player.locations.find(l => l.name.toLowerCase() === lower || l.name.toLowerCase().includes(lower))
        if (match) {
          setFocusedEntity({ type: 'location', loc: match })
        } else {
          setFocusedEntity({ type: 'location', loc: {
            name: detail.name, description: detail.name, last_visited: 0,
            outline_color: undefined, location_features: undefined,
          } as Location })
        }
        setFocusClicks(c => c + 1)
      }
    }
    node.addEventListener('focus-entity', onFocus as EventListener)
    return () => node.removeEventListener('focus-entity', onFocus as EventListener)
  }, [player.side_characters, player.locations])

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
    <div className="char-panel" ref={panelRef}>
      {/* ── Image ── */}
      <div className="char-image-wrap">
        {(!displayUrl || imgState === 'loading') && (
          <div className="char-image-placeholder">
            <span className="sigil">⚗</span>
            <p>{displayUrl ? 'Generating scene…' : 'Generating image…'}</p>
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
                  <div key={i} className="world-item" onClick={() => { setFocusedEntity({ type: 'inventory', item }); setFocusClicks(c => c + 1) }}>
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
                  <div key={i} className="world-item world-item--char" onClick={() => { setFocusedEntity({ type: 'character', char: c }); setFocusClicks(n => n + 1) }}>
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
                  <div key={i} className="world-item world-item--loc" onClick={() => { setFocusedEntity({ type: 'location', loc: l }); setFocusClicks(c => c + 1) }}>
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