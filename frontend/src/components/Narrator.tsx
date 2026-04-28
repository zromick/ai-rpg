// src/components/Narrator.tsx
import { useState, useRef, useEffect } from 'react'
import {
  NARRATION_SERVICES,
  DEFAULT_NARRATION_SERVICE_ID,
  getNarrationService,
  isWebSpeechUrl,
  parseWebSpeechUrl,
} from '../narrationService'

interface NarratorProps {
  enabled: boolean
  lastGMRply?: string
}

export default function Narrator({ enabled, lastGMRply }: NarratorProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const lastNarratedRef = useRef('')
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [currentServiceId, setCurrentServiceId] = useState(DEFAULT_NARRATION_SERVICE_ID)
  const [playing, setPlaying] = useState(false)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [volume, setVolume] = useState(0.5)

  const services = NARRATION_SERVICES
  const currentIdx = services.findIndex(s => s.id === currentServiceId)
  const canPrev = services.length > 1
  const canNext = services.length > 1

  const service = getNarrationService(currentServiceId)

  const stopWebSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    utteranceRef.current = null
  }

  const stop = () => {
    stopWebSpeech()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setPlaying(false)
    if (audioSrc && !isWebSpeechUrl(audioSrc)) {
      URL.revokeObjectURL(audioSrc)
    }
    setAudioSrc(null)
  }

  const switchService = (idx: number) => {
    stop()
    setCurrentServiceId(services[idx].id)
  }

  const speakWebSpeech = (text: string, url: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('Web Speech API not available')
      setPlaying(false)
      return
    }
    stopWebSpeech()
    const params = parseWebSpeechUrl(url)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = params.rate
    utterance.pitch = params.pitch
    utterance.volume = volume
    utterance.onend = () => {
      setPlaying(false)
      utteranceRef.current = null
    }
    utterance.onerror = () => {
      setPlaying(false)
      utteranceRef.current = null
    }
    utteranceRef.current = utterance
    setPlaying(true)
    window.speechSynthesis.speak(utterance)
  }

  const narrate = async (text?: string) => {
    if (!enabled || loading) return
    // Prefer the explicit text; otherwise replay the last GM passage. Only fall
    // back to the demo string if there's no story yet (turn 0 before any reply).
    const speakText = text
      ?? (lastGMRply && lastGMRply.trim())
      ?? "This is a test of the narration voice. The game master will read responses aloud."
    setLoading(true)
    try {
      const url = await service.fetchAudio(speakText)
      if (isWebSpeechUrl(url)) {
        setAudioSrc(null)
        speakWebSpeech(speakText, url)
      } else {
        setAudioSrc(url)
        setPlaying(true)
      }
    } catch (e) {
      console.error('Narrator error:', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!enabled || !lastGMRply || lastGMRply === lastNarratedRef.current || loading) return
    lastNarratedRef.current = lastGMRply
    narrate(lastGMRply)
  }, [lastGMRply, enabled])

  useEffect(() => {
    return () => stopWebSpeech()
  }, [])

  const pause = () => {
    if (utteranceRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      utteranceRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setPlaying(false)
  }

  const onVolume = (v: number) => {
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  if (!enabled) return null

  return (
    <div className="narrator-panel">
      {audioSrc && !isWebSpeechUrl(audioSrc) && (
        <audio ref={audioRef} src={audioSrc} autoPlay onEnded={() => setPlaying(false)} />
      )}

      <div className="narrator-controls">
        {canPrev && (
          <button onClick={() => switchService((currentIdx - 1 + services.length) % services.length)} className="narrator-nav-btn" title="Previous voice">
            ◀◀
          </button>
        )}
        {!playing ? (
          <button onClick={() => narrate()} className="narrator-play-btn" title="Replay the last passage" disabled={loading}>
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
