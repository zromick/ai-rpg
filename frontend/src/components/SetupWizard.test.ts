import { describe, it, expect } from 'vitest'

interface ScenarioRule {
  label: string
  description: string
  default: boolean
}

interface CommonRule {
  label: string
  description: string
  kind: string
  default_active: boolean
  default_level: number
  max_level: number
  level_names: string[]
}

interface Scenario {
  title: string
  description: string
  scenario_rules: ScenarioRule[]
  win_conditions: string
  opening_scene: string
  user_condition: string
  user_inventory: string
}

interface SetupData {
  models: Array<{ label: string; id: string }>
  scenarios: Scenario[]
  common_rules: CommonRule[]
}

type SetupStep = 'model' | 'scenario' | 'scenario_rules' | 'common_rules' | 'players' | 'confirm'

const TEST_DATA: SetupData = {
  models: [
    { label: 'Llama 3.1 8B', id: 'meta-llama/Llama-3.1-8B-Instruct' },
    { label: 'Gemma 2 9B', id: 'google/gemma-2-9b-it' },
  ],
  scenarios: [
    {
      title: 'Void Merchant',
      description: 'Sell alien artifacts in space',
      scenario_rules: [
        { label: 'Debt Clock', description: 'Debt compounds', default: true },
        { label: 'Space Hazards', description: 'Random events', default: false },
      ],
      win_conditions: 'Pay off your debt',
      opening_scene: 'You wake up in a space station...',
      user_condition: 'In debt to alien merchants',
      user_inventory: 'Zero credits',
    },
    {
      title: 'Beggars to Crowns',
      description: 'Rise from poverty to royalty',
      scenario_rules: [
        { label: 'Kingdom Politics', description: 'Court intrigue', default: true },
      ],
      win_conditions: 'Become king',
      opening_scene: 'You wake up in a dungeon...',
      user_condition: 'A beggar',
      user_inventory: 'Rags',
    },
  ],
  common_rules: [
    { label: 'Character Coloring', description: 'Color code characters', kind: 'boolean', default_active: false, default_level: 1, max_level: 1, level_names: ['ON', 'OFF'] },
    { label: 'Theme', description: 'Visual theme', kind: 'level', default_active: true, default_level: 1, max_level: 5, level_names: ['Classic', 'Forest', 'Ocean', 'Crimson', 'Space'] },
    { label: 'Ambient Radio', description: 'Background music', kind: 'boolean', default_active: true, default_level: 1, max_level: 1, level_names: ['ON', 'OFF'] },
  ],
}

const SETUP_UI_RULES = ['Character Coloring', 'Location Coloring', 'Ambient Radio', 'Narration Voice', 'Theme', 'Time Travel']

function validateSetupData(data: SetupData | null): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!data) return { valid: false, errors: ['No data'] }
  if (!data.models?.length) errors.push('No models')
  if (!data.scenarios?.length) errors.push('No scenarios')
  if (!data.common_rules?.length) errors.push('No common rules')
  return { valid: errors.length === 0, errors }
}

function getStepIndex(step: SetupStep): number {
  const steps: SetupStep[] = ['model', 'scenario', 'scenario_rules', 'common_rules', 'players', 'confirm']
  return steps.indexOf(step)
}

function canAdvanceStep(currentStep: SetupStep, data: SetupData | null): boolean {
  if (!data) return false
  if (currentStep === 'model') return true
  if (currentStep === 'scenario') return data.scenarios.length > 0
  if (currentStep === 'scenario_rules') return true
  if (currentStep === 'common_rules') return true
  if (currentStep === 'players') return true
  return false
}

function getDefaultRules(data: SetupData | null): Array<{ active: boolean; current_level: number }> {
  if (!data?.common_rules) return []
  return data.common_rules.map(r => ({
    active: r.default_active,
    current_level: r.default_level,
  }))
}

function filterUiRules(data: SetupData | null): CommonRule[] {
  if (!data) return []
  return data.common_rules.filter(r => SETUP_UI_RULES.includes(r.label))
}

function buildSetupPayload(_data: SetupData, selected: {
  model: string
  scenarioIdx: number
  scenarioRules: boolean[]
  commonRules: Array<{ active: boolean; current_level: number }>
  players: string[]
}): {
  model: string
  scenario_idx: number
  scenario_rules: boolean[]
  common_rules: Array<{ active: boolean; current_level: number }>
  players: string[]
} {
  return {
    model: selected.model,
    scenario_idx: selected.scenarioIdx,
    scenario_rules: selected.scenarioRules,
    common_rules: selected.commonRules,
    players: selected.players.filter(p => p.trim().length > 0),
  }
}

describe('SetupWizard', () => {
  describe('Data Validation', () => {
    it('should validate null data', () => {
      const result = validateSetupData(null)
      expect(result.valid).toBe(false)
    })

    it('should validate complete data', () => {
      const result = validateSetupData(TEST_DATA)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should have valid model options', () => {
      TEST_DATA.models.forEach(m => {
        expect(m.id).toContain('/')
        expect(m.label).toBeDefined()
      })
    })

    it('should have valid scenario options', () => {
      TEST_DATA.scenarios.forEach(s => {
        expect(s.title).toBeDefined()
        expect(s.scenario_rules).toBeDefined()
      })
    })
  })

  describe('Step Navigation', () => {
    it('should have correct step order', () => {
      expect(getStepIndex('model')).toBe(0)
      expect(getStepIndex('scenario')).toBe(1)
      expect(getStepIndex('confirm')).toBe(5)
    })

    it('can advance from model step', () => {
      expect(canAdvanceStep('model', TEST_DATA)).toBe(true)
    })

    it('can advance from scenario step', () => {
      expect(canAdvanceStep('scenario', TEST_DATA)).toBe(true)
    })

    it('cannot advance with null data', () => {
      expect(canAdvanceStep('model', null)).toBe(false)
    })
  })

  describe('Default Rules', () => {
    it('should extract default rules from data', () => {
      const rules = getDefaultRules(TEST_DATA)
      expect(rules.length).toBe(TEST_DATA.common_rules.length)
    })

    it('should have correct default values', () => {
      const rules = getDefaultRules(TEST_DATA)
      expect(rules[0].active).toBe(false)  // Character Coloring
      expect(rules[1].active).toBe(true)   // Theme
      expect(rules[2].active).toBe(true)   // Ambient Radio
    })
  })

  describe('UI Rule Filtering', () => {
    it('should filter UI rules', () => {
      const uiRules = filterUiRules(TEST_DATA)
      expect(uiRules.length).toBe(3)  // Character Coloring, Theme, Ambient Radio
    })

    it('should include Theme in UI rules', () => {
      const uiRules = filterUiRules(TEST_DATA)
      expect(uiRules.find(r => r.label === 'Theme')).toBeDefined()
    })
  })

  describe('Payload Building', () => {
    it('should build valid payload', () => {
      const payload = buildSetupPayload(TEST_DATA, {
        model: 'meta-llama/Llama-3.1-8B-Instruct',
        scenarioIdx: 0,
        scenarioRules: [true, false],
        commonRules: [{ active: false, current_level: 1 }, { active: true, current_level: 3 }],
        players: ['Hero'],
      })
      expect(payload.model).toBe('meta-llama/Llama-3.1-8B-Instruct')
      expect(payload.scenario_idx).toBe(0)
    })

    it('should filter empty player names', () => {
      const payload = buildSetupPayload(TEST_DATA, {
        model: 'meta-llama/Llama-3.1-8B-Instruct',
        scenarioIdx: 0,
        scenarioRules: [true],
        commonRules: [{ active: true, current_level: 1 }],
        players: ['', 'Hero', ''],
      })
      expect(payload.players).toEqual(['Hero'])
    })
  })
})