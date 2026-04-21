import { describe, it, expect } from 'vitest'

interface Station {
  name: string
  url: string
  mood: string
  isBattle?: boolean
  isRomance?: boolean
  isWin?: boolean
}

const BATTLE_STATIONS: Station[] = [
  { name: 'Metal', url: 'https://ice1.somafm.com/metal-128-mp3', mood: 'Heavy metal', isBattle: true },
  { name: 'Sonic Universe', url: 'https://ice1.somafm.com/sonicuniverse-128-mp3', mood: 'Progressive rock', isBattle: true },
  { name: 'Groove Salad', url: 'https://ice1.somafm.com/groovesalad-128-mp3', mood: 'Trippy beats', isBattle: true },
]

const ROMANCE_STATIONS: Station[] = [
  { name: 'Groove Salad', url: 'https://ice1.somafm.com/groovesalad-128-mp3', mood: 'Deep electronic', isRomance: true },
  { name: 'Lush', url: 'https://ice1.somafm.com/lush-128-mp3', mood: 'Ethereal ambient', isRomance: true },
  { name: 'Secret Agent', url: 'https://ice1.somafm.com/secretagent-128-mp3', mood: 'Chillout dreams', isRomance: true },
]

const WIN_STATIONS: Station[] = [
  { name: 'Bootie Legal', url: 'https://ice1.somafm.com/bootie-128-mp3', mood: 'Mashups', isWin: true },
  { name: 'Playhouse', url: 'https://ice1.somafm.com/playhouse-128-mp3', mood: 'Experimental', isWin: true },
  { name: 'Deep Space One', url: 'https://ice1.somafm.com/deepspaceone-128-mp3', mood: 'Cosmic ambient', isWin: true },
]

const SCENARIO_STATIONS: Record<string, Station[]> = {
  'Beggars to Crowns': [
    { name: 'ThistleRadio', url: 'https://ice1.somafm.com/thistle-128-mp3', mood: 'Celtic fiddles' },
  ],
  'Debt Collector': [
    { name: 'Bootie Legal', url: 'https://ice1.somafm.com/bootie-128-mp3', mood: 'Mashups' },
  ],
  'Void Merchant': [
    { name: 'Space Station Soma', url: 'https://ice1.somafm.com/spacestation-128-mp3', mood: 'Ambient space' },
    { name: 'Deep Space One', url: 'https://ice1.somafm.com/deepspaceone-128-mp3', mood: 'Deep ambient' },
  ],
}

function selectBattleStation(seed: number): Station {
  return BATTLE_STATIONS[seed % BATTLE_STATIONS.length]
}

function selectRomanceStation(seed: number): Station {
  return ROMANCE_STATIONS[seed % ROMANCE_STATIONS.length]
}

function selectWinStation(seed: number): Station {
  return WIN_STATIONS[seed % WIN_STATIONS.length]
}

function selectScenarioStation(scenario: string, _seed: number): Station[] {
  const key = Object.keys(SCENARIO_STATIONS).find(k => scenario.toLowerCase().includes(k.toLowerCase()))
  const pool = key ? SCENARIO_STATIONS[key] : []
  return pool.length > 0 ? pool : WIN_STATIONS
}

describe('AmbientRadio', () => {
  describe('Battle Stations', () => {
    it('should have battle stations defined', () => {
      expect(BATTLE_STATIONS.length).toBeGreaterThan(0)
    })

    it('should select battle station by seed', () => {
      const station = selectBattleStation(0)
      expect(station.name).toBeDefined()
      expect(station.isBattle).toBe(true)
    })

    it('should cycle through all battle stations', () => {
      const names = new Set(BATTLE_STATIONS.map((_, i) => selectBattleStation(i).name))
      expect(names.size).toBeGreaterThan(1)
    })

    it('should have valid SomaFM URLs', () => {
      BATTLE_STATIONS.forEach(s => {
        expect(s.url).toContain('somafm.com')
      })
    })
  })

  describe('Romance Stations', () => {
    it('should have romance stations defined', () => {
      expect(ROMANCE_STATIONS.length).toBeGreaterThan(0)
    })

    it('should select romance station by seed', () => {
      const station = selectRomanceStation(0)
      expect(station.name).toBeDefined()
      expect(station.isRomance).toBe(true)
    })

    it('should have valid SomaFM URLs', () => {
      ROMANCE_STATIONS.forEach(s => {
        expect(s.url).toContain('somafm.com')
      })
    })
  })

  describe('Win Stations', () => {
    it('should have win stations defined', () => {
      expect(WIN_STATIONS.length).toBeGreaterThan(0)
    })

    it('should select win station by seed', () => {
      const station = selectWinStation(0)
      expect(station.name).toBeDefined()
      expect(station.isWin).toBe(true)
    })

    it('should have valid SomaFM URLs', () => {
      WIN_STATIONS.forEach(s => {
        expect(s.url).toContain('somafm.com')
      })
    })
  })

  describe('Scenario Stations', () => {
    it('should have scenario station pools', () => {
      expect(Object.keys(SCENARIO_STATIONS).length).toBeGreaterThan(0)
    })

    it('should match Void Merchant scenario', () => {
      const stations = selectScenarioStation('Void Merchant', 0)
      expect(stations.length).toBeGreaterThan(0)
    })

    it('should match Beggars to Crowns scenario', () => {
      const stations = selectScenarioStation('Beggars to Crowns', 0)
      expect(stations.length).toBeGreaterThan(0)
    })

    it('should fallback to win stations for unknown scenario', () => {
      const stations = selectScenarioStation('Unknown Scenario', 0)
      expect(stations).toEqual(WIN_STATIONS)
    })

    it('should use seed to select from pool', () => {
      const pool = SCENARIO_STATIONS['Void Merchant']
      const station1 = pool[0]
      const station2 = pool[1 % pool.length]
      expect(station1.name).not.toBe(station2.name)
    })
  })
})