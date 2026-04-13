// src/components/CharacterPanel.tsx
import { useCharacterImage } from '../hooks/UseCharacterImage'
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
  const { url, loading, error } = useCharacterImage(
    player.image_prompt,
    player.last_gm_reply,
    seed,
    service,
  )

  const custom = Object.entries(player.character_features).filter(
    ([k]) => !CORE_FIELDS.includes(k)
  )

  return (
    <div className="char-panel">
      {/* Image viewport */}
      <div className="char-image-wrap">
        {loading && (
          <div className="char-image-placeholder">
            <span className="sigil">⚗</span>
            <p>Conjuring scene…</p>
          </div>
        )}
        {error && (
          <div className="char-image-placeholder error">
            <span className="sigil">✕</span>
            <p>{error}</p>
          </div>
        )}
        {url && !loading && (
          <img
            src={url}
            alt={`${player.name} in action`}
            className="char-image"
          />
        )}
        <div className="char-image-caption">
          <span>{player.name}</span>
          {loading && <span className="badge loading">generating…</span>}
        </div>
      </div>

      {/* Feature table */}
      <div className="char-features">
        <h3 className="features-title">Character</h3>
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
      </div>
    </div>
  )
}
