// src/components/Narrator.tsx
import { useState, useRef } from 'react'
import { NARRATION_SERVICES, DEFAULT_NARRATION_SERVICE_ID, getNarrationService } from '../narrationService'

interface NarratorProps {
  enabled: boolean
}

export default function Narrator({ enabled }: NarratorProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentServiceId, setCurrentServiceId] = useState(DEFAULT_NARRATION_SERVICE_ID)
  const [playing, setPlaying] = useState(false)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const service = getNarrationService(currentServiceId)

  const narrate = async () => {
    if (!enabled || loading) return
    setLoading(true)
    try {
      const url = await service.fetchAudio("This is a test of the narration voice. The game master will read responses aloud.")
      setAudioSrc(url)
      setPlaying(true)
    } catch (e) {
      console.error('Narrator error:', e)
    }
    setLoading(false)
  }

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setPlaying(false)
  }

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setPlaying(false)
    if (audioSrc) {
      URL.revokeObjectURL(audioSrc)
      setAudioSrc(null)
    }
  }

  if (!enabled) return null

  return (
    <div className="narrator-panel">
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} onEnded={stop} />
      )}

      <div className="narrator-controls">
        {!playing ? (
          <button onClick={narrate} className="narrator-play-btn" title="Test narration" disabled={loading}>
            {loading ? '…' : '▶'}
          </button>
        ) : (
          <button onClick={pause} className="narrator-play-btn" title="Stop">
            ■
          </button>
        )}
      </div>

      <div className="narrator-station-info">
        <span className="narrator-station-name">{service.name}</span>
        <span className="narrator-mood">{service.voice}</span>
      </div>

      <div className="narrator-service-list">
        {NARRATION_SERVICES.map((s) => (
          <button
            key={s.id}
            onClick={() => { setCurrentServiceId(s.id); stop() }}
            className={`narrator-station-btn ${s.id === currentServiceId ? 'active' : ''}`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}