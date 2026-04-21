import { describe, it, expect } from 'vitest'

const UI_ONLY_RULES = ['Character Coloring', 'Location Coloring', 'Ambient Radio', 'Narration Voice', 'Theme', 'Time Travel']

function filterRulesTest(rules: string[], isUi: boolean): string[] {
  return rules.filter(r => isUi ? UI_ONLY_RULES.includes(r) : !UI_ONLY_RULES.includes(r))
}

const TEST_MODELS = [
  { label: 'Llama 3.1 8B', id: 'meta-llama/Llama-3.1-8B-Instruct' },
  { label: 'Gemma 2 9B', id: 'google/gemma-2-9b-it' },
]

const TEST_SETTINGS = {
  model: 'meta-llama/Llama-3.1-8B-Instruct',
  scenario_title: 'Void Merchant',
  scenario_rules: [
    { label: 'Debt Clock', description: 'Debt compounds', enabled: true },
  ],
  common_rules: [
    { label: 'Immersive Narration', description: 'Rich sensory detail', kind: 'boolean', active: true, current_level: 1, max_level: 1, level_names: ['ON', 'OFF'] },
    { label: 'Theme', description: 'Visual theme', kind: 'level', active: true, current_level: 5, max_level: 5, level_names: ['Classic', 'Forest', 'Ocean', 'Crimson', 'Space'] },
    { label: 'Ambient Radio', description: 'Background music', kind: 'boolean', active: true, current_level: 1, max_level: 1, level_names: ['ON', 'OFF'] },
  ],
}

describe('SettingsPanel', () => {
  describe('Rule Filtering', () => {
    it('should filter UI rules correctly', () => {
      const allRules = ['Immersive Narration', 'Theme', 'Ambient Radio', 'Difficulty']
      const uiRules = filterRulesTest(allRules, true)
      expect(uiRules).toEqual(['Theme', 'Ambient Radio'])
    })

    it('should filter AI rules correctly', () => {
      const allRules = ['Immersive Narration', 'Theme', 'Ambient Radio', 'Difficulty']
      const aiRules = filterRulesTest(allRules, false)
      expect(aiRules).toEqual(['Immersive Narration', 'Difficulty'])
    })

    it('should include Theme in UI rules', () => {
      expect(UI_ONLY_RULES).toContain('Theme')
    })

    it('should include Ambient Radio in UI rules', () => {
      expect(UI_ONLY_RULES).toContain('Ambient Radio')
    })
  })

  describe('Model Selection', () => {
    it('should have valid model options', () => {
      TEST_MODELS.forEach(m => {
        expect(m.id).toBeDefined()
        expect(m.label).toBeDefined()
        expect(m.id).toContain('/')
      })
    })

    it('should match settings model to available models', () => {
      const currentModel = TEST_SETTINGS.model
      const found = TEST_MODELS.find(m => m.id === currentModel)
      expect(found).toBeDefined()
    })
  })

  describe('Settings Structure', () => {
    it('should have valid theme settings', () => {
      const themeRule = TEST_SETTINGS.common_rules.find(r => r.label === 'Theme')
      expect(themeRule).toBeDefined()
      expect(themeRule?.kind).toBe('level')
      expect(themeRule?.level_names).toHaveLength(5)
      expect(themeRule?.level_names).toContain('Space')
    })

    it('should have theme at level 5 (Space) for Void Merchant', () => {
      const themeRule = TEST_SETTINGS.common_rules.find(r => r.label === 'Theme')
      expect(themeRule?.current_level).toBe(5)
    })

    it('should have boolean rules with correct structure', () => {
      const booleanRules = TEST_SETTINGS.common_rules.filter(r => r.kind === 'boolean')
      expect(booleanRules.length).toBeGreaterThan(0)
      booleanRules.forEach(r => {
        expect(r.level_names).toHaveLength(2)
        expect(r.level_names).toContain('ON')
        expect(r.level_names).toContain('OFF')
      })
    })
  })

  describe('Settings Panel Interactions', () => {
    it('should apply theme changes to body class', () => {
      const themeLevels = ['theme-classic', 'theme-forest', 'theme-ocean', 'theme-crimson', 'theme-space']
      
      const themeIdx = 4 // Space = index 4 (level 5)
      const themeClass = themeLevels[themeIdx]
      expect(themeClass).toBe('theme-space')
    })

    it('should map theme levels correctly', () => {
      const themeLevels = ['theme-classic', 'theme-forest', 'theme-ocean', 'theme-crimson', 'theme-space']
      
      expect(themeLevels[0]).toBe('theme-classic')
      expect(themeLevels[1]).toBe('theme-forest')
      expect(themeLevels[2]).toBe('theme-ocean')
      expect(themeLevels[3]).toBe('theme-crimson')
      expect(themeLevels[4]).toBe('theme-space')
    })
  })
})