import { describe, it, expect } from 'vitest'

const MODEL_BY_ID: Record<string, string> = {
  'meta-llama/llama-3.3-70b-instruct': 'meta-llama/Llama-3.3-70B-Instruct',
  'qwen/qwen2.5-72b-instruct': 'Qwen/Qwen2.5-72B-Instruct',
  'meta-llama/llama-3.1-8b-instruct': 'meta-llama/Llama-3.1-8B-Instruct',
  'meta-llama/llama-3.1-8binstruct': 'meta-llama/Llama-3.1-8B-Instruct',
  'meta-llama/llama-3-1-8b-instruct': 'meta-llama/Llama-3.1-8B-Instruct',
  'google/gemma-2-9b-it': 'google/gemma-2-9b-it',
  'mistralai/mistral-7b-instruct-v0.3': 'mistralai/Mistral-7B-Instruct-v0.3',
  'mistralai/mistral-nemo-instruct-2407': 'mistralai/Mistral-Nemo-Instruct-2407',
  'huggingfaceh4/zephyr-7b-beta': 'HuggingFaceH4/zephyr-7b-beta',
  'nousresearch/hermes-3-llama-3.1-8b': 'NousResearch/Hermes-3-Llama-3.1-8B',
  'mistralai/mixtral-8x7b-instruct-v0.1': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  'microsoft/phi-3-medium-128k-instruct': 'microsoft/Phi-3-medium-128k-instruct',
}

const DEFAULT_MODEL_ID = 'meta-llama/Llama-3.3-70B-Instruct'
const KNOWN_MODEL_IDS = new Set(Object.values(MODEL_BY_ID))

function normalizeModel(m: string): string {
  if (!m) return m
  const lower = m.toLowerCase()
  if (MODEL_BY_ID[lower]) return MODEL_BY_ID[lower]
  for (const [, v] of Object.entries(MODEL_BY_ID)) {
    if (v.toLowerCase() === lower) return v
  }
  if (!KNOWN_MODEL_IDS.has(m)) return DEFAULT_MODEL_ID
  return m
}

describe('Model Normalization', () => {
  it('should normalize lowercase model IDs', () => {
    expect(normalizeModel('meta-llama/llama-3.1-8b-instruct')).toBe('meta-llama/Llama-3.1-8B-Instruct')
  })

  it('should return already normalized IDs', () => {
    expect(normalizeModel('google/gemma-2-9b-it')).toBe('google/gemma-2-9b-it')
  })

  it('should handle mixed case', () => {
    expect(normalizeModel('MISTRALAI/MISTRAL-7B-INSTRUCT-V0.3')).toBe('mistralai/Mistral-7B-Instruct-v0.3')
  })

  it('should return empty string for empty input', () => {
    expect(normalizeModel('')).toBe('')
  })

  it('should handle unknown models', () => {
    expect(normalizeModel('unknown/model')).toBe('meta-llama/Llama-3.3-70B-Instruct')
  })
})

const THEME_CLASSES = ['theme-classic', 'theme-forest', 'theme-ocean', 'theme-crimson', 'theme-space']

function getScenarioTheme(scenario: string): number {
  const s = scenario?.toLowerCase() || ''
  if (s.includes('debt collector')) return 4
  if (s.includes('lost heir') || s.includes('king')) return 1
  if (s.includes('cursed relic')) return 4
  if (s.includes('assassin')) return 4
  if (s.includes('grain') || s.includes('poison')) return 2
  if (s.includes('forgotten temple')) return 4
  if (s.includes('veteran')) return 3
  if (s.includes('double agent')) return 3
  if (s.includes('beggar')) return 1
  if (s.includes('shipwreck')) return 3
  if (s.includes('haunted')) return 4
  if (s.includes('void') || s.includes('merchant') || s.includes('space')) return 5
  return 1
}

describe('Theme Resolution', () => {
  it('should return classic theme for beggar scenarios', () => {
    expect(getScenarioTheme('Beggar to King')).toBe(1)
  })

  it('should return crimson theme for debt collector', () => {
    expect(getScenarioTheme('Debt Collector')).toBe(4)
  })

  it('should return forest theme for grain/poison', () => {
    expect(getScenarioTheme('The Grain Conspiracy')).toBe(2)
    expect(getScenarioTheme('The Poisoned Well')).toBe(2)
  })

  it('should return ocean theme for shipwreck', () => {
    expect(getScenarioTheme('Shipwrecked')).toBe(3)
  })

  it('should return space theme for void merchant', () => {
    expect(getScenarioTheme('Void Merchant')).toBe(5)
  })

  it('should return theme class by index', () => {
    expect(THEME_CLASSES[0]).toBe('theme-classic')
    expect(THEME_CLASSES[1]).toBe('theme-forest')
    expect(THEME_CLASSES[2]).toBe('theme-ocean')
    expect(THEME_CLASSES[3]).toBe('theme-crimson')
    expect(THEME_CLASSES[4]).toBe('theme-space')
  })

  it('should handle empty scenario', () => {
    expect(getScenarioTheme('')).toBe(1)
  })

  it('should handle null scenario', () => {
    expect(getScenarioTheme(null as any)).toBe(1)
  })
})

function nameSeed(name: string): number {
  let h = 0
  for (const c of name) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

const NAME_SETS: Record<string, string[]> = {
  classic: [
    'Aldric Shadowmere', 'Seraphina Blackwood', 'Kael Ironforge', 'Morgana Nightwind', 'Theron Silverbrook',
    'Elowen Stormcaller', 'Dorian Grayhaven', 'Isolde Fairweather', 'Ragnar Bloodaxe', 'Lyria Moonshadow'
  ],
  space: [
    'Zyx Voidwalker', 'Nebula Starborn', 'Orion Voidmere', 'Lyra Cosmicwind', 'Drax Shadowforge',
    'Celeste Nightstar', 'Kael Voidhaven', 'Iris Fairnebula', 'Ragnar Staraxe', 'Nova Moonwalker'
  ],
}

function getRandomName(template: number, seed?: number): string {
  let nameSet = NAME_SETS.classic
  if (template === 5) nameSet = NAME_SETS.space
  const idx = seed !== undefined ? seed % nameSet.length : Math.floor(Math.random() * nameSet.length)
  return nameSet[idx]
}

describe('Name Seed', () => {
  it('should generate consistent seeds for same name', () => {
    expect(nameSeed('TestPlayer')).toBe(nameSeed('TestPlayer'))
  })

  it('should generate different seeds for different names', () => {
    expect(nameSeed('Player1')).not.toBe(nameSeed('Player2'))
  })

  it('should handle empty string', () => {
    expect(nameSeed('')).toBe(0)
  })
})

describe('Random Names', () => {
  it('should return consistent names with same seed', () => {
    expect(getRandomName(5, 100)).toBe(getRandomName(5, 100))
  })

  it('should return different names with different seeds', () => {
    expect(getRandomName(5, 100)).not.toBe(getRandomName(5, 101))
  })

  it('should return space names for template 5', () => {
    const name = getRandomName(5, 0)
    expect(NAME_SETS.space).toContain(name)
  })

  it('should return classic names for other templates', () => {
    const name = getRandomName(1, 0)
    expect(NAME_SETS.classic).toContain(name)
  })
})