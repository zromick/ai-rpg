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
  const [volume, setVolume] = useState(0.5)

  const services = NARRATION_SERVICES
  const currentIdx = services.findIndex(s => s.id === currentServiceId)
  const canPrev = services.length > 1
  const canNext = services.length > 1

  const switchService = (idx: number) => {
    stop()
    setCurrentServiceId(services[idx].id)
  }

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

  const onVolume = (v: number) => {
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  if (!enabled) return null

  return (
    <div className="narrator-panel">
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} onEnded={stop} />
      )}

      <div className="narrator-controls">
        {canPrev && (
          <button onClick={() => switchService((currentIdx - 1 + services.length) % services.length)} className="narrator-nav-btn" title="Previous voice">
            ◀◀
          </button>
        )}
        {!playing ? (
          <button onClick={narrate} className="narrator-play-btn" title="Test narration" disabled={loading}>
            {loading ? '…' : '▶'}
          </button>
        ) : (
          <button onClick={pause} className="narrator-play-btn" title="Stop">
            ■
          </button>
        )}
        {canNext && (
          <button onClick={() => switchService((currentIdx + 1) % services.length)} className="narrator-nav-btn" title="Next voice">
            ▶▶
          </button>
        )}
      </div>

      <div className="narrator-station-info">
        <span className="narrator-station-name">{service.name}</span>
        <span className="narrator-mood">{service.voice}</span>
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onVolume(parseFloat(e.target.value))}
        className="narrator-volume"
        title={`Volume: ${Math.round(volume * 100)}%`}
      />

      <div className="narrator-service-list">
        {services.map((s) => (
          <button
            key={s.id}
            onClick={() => switchService(services.findIndex(svc => svc.id === s.id))}
            className={`narrator-station-btn ${s.id === currentServiceId ? 'active' : ''}`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}