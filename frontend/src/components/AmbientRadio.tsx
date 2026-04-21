// AmbientRadio.tsx

import { useState, useRef, useEffect } from 'react'

// ── Station pool per scenario ───────────────────────────────────────────────

interface Station {
name: string
url: string
mood: string
isBattle?: boolean
isRomance?: boolean
isWin?: boolean
}

// Battle theme stations - tense, combat, action
const BATTLE_STATIONS: Station[] = [
  {
    name: 'Metal',
    url: 'https://ice1.somafm.com/metal-128-mp3',
    mood: 'Heavy metal — battle cries and clashing steel',
    isBattle: true,
  },
  {
    name: 'Sonic Universe',
    url: 'https://ice1.somafm.com/sonicuniverse-128-mp3',
    mood: 'Progressive rock — epic fights and desperate stands',
    isBattle: true,
  },
  {
    name: 'Groove Salad',
    url: 'https://ice1.somafm.com/groovesalad-128-mp3',
    mood: 'Trippy beats — tense pursuits and shadow missions',
    isBattle: true,
  },
]

// Romance mode stations - romantic, intimate, emotional
const ROMANCE_STATIONS: Station[] = [
  {
    name: 'Groove Salad',
    url: 'https://ice1.somafm.com/groovesalad-128-mp3',
    mood: 'Deep electronic — tender moments and quiet intimacy',
    isRomance: true,
  },
  {
    name: 'Lush',
    url: 'https://ice1.somafm.com/lush-128-mp3',
    mood: 'Ethereal ambient — moonlit confessions and stolen glances',
    isRomance: true,
  },
  {
    name: 'Secret Agent',
    url: 'https://ice1.somafm.com/secretagent-128-mp3',
    mood: 'Chillout dreams — soft words and warm embraces',
    isRomance: true,
  },
]

// Win mode stations - triumphant, victorious, celebratory
const WIN_STATIONS: Station[] = [
  {
    name: 'Bootie Legal',
    url: 'https://ice1.somafm.com/bootie-128-mp3',
    mood: ' Mashups — victory dances and triumphant returns',
    isWin: true,
  },
  {
    name: 'Playhouse',
    url: 'https://ice1.somafm.com/playhouse-128-mp3',
    mood: 'Experimental — new beginnings and epic conclusions',
    isWin: true,
  },
  {
    name: 'Deep Space One',
    url: 'https://ice1.somafm.com/deepspaceone-128-mp3',
    mood: 'Cosmic ambient — legends told and thrones claimed',
    isWin: true,
  },
]

const SCENARIO_STATIONS: Record<string, Station[]> = {

// Beggars to Crowns — medieval fantasy, grimy city, taverns, cathedrals
'Beggars to Crowns': [
  {
    name: 'ThistleRadio',
    url: 'https://ice1.somafm.com/thistle-128-mp3',
    mood: 'Celtic fiddles and folk — tavern nights and forest roads',
  },
  {
    name: 'Lush',
    url: 'https://ice1.somafm.com/lush-128-mp3',
    mood: 'Ethereal and dreamlike — cathedral echoes and moonlit courts',
  },
  {
    name: 'Drone Zone',
    url: 'https://ice1.somafm.com/dronezone-128-mp3',
    mood: 'Deep ambient — dungeons, fog, and the weight of a kingdom',
  },
],

// Shipwrecked on the Obsidian Shore — volcanic island, tribes, jungle, ocean
'Shipwrecked on the Obsidian Shore': [
  {
    name: 'Suburbs of Goa',
    url: 'https://ice1.somafm.com/suburbsofgoa-128-mp3',
    mood: 'World and tribal downtempo — firelight and distant drums',
  },
  {
    name: 'Drone Zone',
    url: 'https://ice1.somafm.com/dronezone-128-mp3',
    mood: 'Vast ambient — open ocean, volcanic rumble, isolation',
  },
  {
    name: 'Lush',
    url: 'https://ice1.somafm.com/lush-128-mp3',
    mood: 'Otherworldly textures — bioluminescent jungle and ancient ruins',
  },
],

// The Haunted Precinct — 1920s noir, jazz, rain, cosmic horror
'The Haunted Precinct': [
  {
    name: 'Secret Agent',
    url: 'https://ice1.somafm.com/secretagent-128-mp3',
    mood: 'Noir lounge and cool jazz — smoke, rain, and revolver steel',
  },
  {
    name: 'Illinois Street Lounge',
    url: 'https://ice1.somafm.com/illstreet-128-mp3',
    mood: 'Retro exotica — speakeasy glamour and creeping unease',
  },
  {
    name: 'Drone Zone',
    url: 'https://ice1.somafm.com/dronezone-128-mp3',
    mood: 'Dark ambient — sanity fraying, the city breathing beneath you',
  },
],

// Void Merchant — space opera, salvage freighter, dying star system
'Void Merchant': [
  {
    name: 'Deep Space One',
    url: 'https://ice1.somafm.com/deepspaceone-128-mp3',
    mood: 'Deep space ambient — drifting through the Kalveth Expanse',
  },
  {
    name: 'Space Station Soma',
    url: 'https://ice1.somafm.com/spacestation-128-mp3',
    mood: 'Spaced-out electronic — port docking and neon cargo bays',
  },
  {
    name: 'Mission Control',
    url: 'https://ice1.somafm.com/missioncontrol-128-mp3',
    mood: 'Ambient with NASA transmissions — hull creaks and comms static',
  },
],
}

// Fallback if scenario title doesn't match
const DEFAULT_STATIONS: Station[] = SCENARIO_STATIONS['Beggars to Crowns']

// ── Component ───────────────────────────────────────────────────────────────

interface AmbientRadioProps {
scenarioTitle: string
isBattle?: boolean
isRomance?: boolean
isWin?: boolean
}

export default function AmbientRadio({ scenarioTitle, isBattle, isRomance, isWin }: AmbientRadioProps) {
const audioRef = useRef<HTMLAudioElement>(null)
const [playing, setPlaying] = useState(false)
const [stationIdx, setStationIdx] = useState(0)
const [volume, setVolume] = useState(0.25)
const [lastMode, setLastMode] = useState('')

const baseStations = SCENARIO_STATIONS[scenarioTitle] ?? DEFAULT_STATIONS

function getStations() {
  if (isBattle) return BATTLE_STATIONS
  if (isRomance) return ROMANCE_STATIONS
  if (isWin) return WIN_STATIONS
  return baseStations
}

const stations = getStations()

// Reset station index when scenario changes - and autoplay
useEffect(() => {
  setStationIdx(0)
  if (audioRef.current) {
    audioRef.current.volume = volume
    audioRef.current.play().catch(() => {})
  }
  setPlaying(true)
}, [scenarioTitle])

// Switch stations when mode changes, always autoplay
useEffect(() => {
  const currentMode = isBattle ? 'battle' : isRomance ? 'romance' : isWin ? 'win' : 'default'
  if (currentMode !== lastMode) {
    setLastMode(currentMode)
    setStationIdx(0)
    setPlaying(true)
    if (audioRef.current) {
      audioRef.current.volume = volume
      audioRef.current.play().catch(() => {})
    }
  }
}, [isBattle, isRomance, isWin])

const station = stations[stationIdx]

const toggle = () => {
  if (!audioRef.current) return
  if (playing) {
    audioRef.current.pause()
  } else {
    audioRef.current.volume = volume
    audioRef.current.play()
  }
  setPlaying(!playing)
}

const switchStation = async (idx: number) => {
  if (!audioRef.current) return
  const wasPlaying = playing
  audioRef.current.pause()
  setStationIdx(idx)
  audioRef.current.load()
  audioRef.current.volume = volume
  if (wasPlaying) {
    try {
      await audioRef.current.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }
}

const onVolume = (v: number) => {
  setVolume(v)
  if (audioRef.current) audioRef.current.volume = v
}

const canPrev = stations.length > 1
  const canNext = stations.length > 1

  return (
    <div className="ambient-radio">
      <audio ref={audioRef} src={station.url} />

      <div className="radio-controls">
        {canPrev && (
          <button onClick={() => switchStation((stationIdx - 1 + stations.length) % stations.length)} className="radio-nav-btn" title="Previous station">
            ◀◀
          </button>
        )}
        <button onClick={toggle} className="radio-play-btn" title={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        {canNext && (
          <button onClick={() => switchStation((stationIdx + 1) % stations.length)} className="radio-nav-btn" title="Next station">
            ▶▶
          </button>
        )}
      </div>

      <div className="radio-station-info">
        <span className="radio-station-name">{station.name}</span>
        <span className="radio-mood">{station.mood}</span>
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onVolume(parseFloat(e.target.value))}
        className="radio-volume"
        title={`Volume: ${Math.round(volume * 100)}%`}
      />

      <div className="radio-station-list">
        {stations.map((s, i) => (
          <button
            key={s.name}
            onClick={() => switchStation(i)}
            className={`radio-station-btn ${i === stationIdx ? 'active' : ''}`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}
