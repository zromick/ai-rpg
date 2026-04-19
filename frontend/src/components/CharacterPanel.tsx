// src/components/CharacterPanel.tsx
import { useState, useEffect } from 'react'
import { useCharacterImage } from '../hooks/useCharacterImage'
import type { PlayerState, ImageService } from '../types'

interface Props {
  player: PlayerState
  seed: number
  service: ImageService
}

const CORE_FIELDS = [
  'age','gender','build','height','hair_color','hair_style',
  'eye_color','skin_tone','scars','clothing','expression','distinguishing',
]

export function CharacterPanel({ player, seed, service }: Props) {
  const { url } = useCharacterImage(player.image_prompt, player.last_gm_reply, seed, service)
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [activeTab, setActiveTab] = useState<'features' | 'inventory' | 'characters' | 'locations'>('features')

  // Reset loading state when URL changes
  useEffect(() => { if (url) setImgState('loading') }, [url])

  const custom = Object.entries(player.character_features).filter(([k]) => !CORE_FIELDS.includes(k))

  const hasPlayed = player && player.prompt_count > 0

  return (
    <div className="char-panel">
      {/* ── Image ── */}
      <div className="char-image-wrap">
        {(!url || imgState === 'loading') && (
          <div className="char-image-placeholder">
            <span className="sigil">⚗</span>
            {url ? (
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
        {url && (
          <img
            key={url}
            src={url}
            alt={`${player.name} in action`}
            className="char-image"
            style={{ display: imgState === 'loaded' ? 'block' : 'none' }}
            onLoad={() => setImgState('loaded')}
            onError={() => setImgState('error')}
          />
        )}
        <div className="char-image-caption" style={{ display: 'none' }}>
          {imgState === 'loading' && url && <span className="badge loading">generating…</span>}
        </div>
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

        {activeTab === 'inventory' && (
          <div className="world-list">
            {player.inventory.length === 0
              ? <p className="world-empty">No items yet</p>
              : player.inventory.map((item, i) => (
                  <div key={i} className="world-item">
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
                  <div key={i} className="world-item world-item--char">
                    <div className="world-item-header">
                      <span className="world-item-name" data-status={c.relation} style={{ borderColor: c.outline_color }}>{c.name}</span>
                      {c.outline_color && <span className="world-item-outline" style={{ backgroundColor: c.outline_color }} title="Character color" />}
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
                  <div key={i} className="world-item world-item--loc">
                    <div className="world-item-header">
                      <span className="world-item-name" style={{ borderColor: l.outline_color }}>{l.name}</span>
                      {l.outline_color && <span className="world-item-outline" style={{ backgroundColor: l.outline_color }} title="Location color" />}
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
