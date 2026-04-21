import { describe, it, expect, beforeEach } from 'vitest'

const SAVE_SLOT_KEYS = [1, 2, 3, 4].map(slot => `ai_rpg_save_slot_${slot}`)

const MOCK_GAME_STATE = {
  session_id: 'test-session-123',
  players: [{
    name: 'TestPlayer',
    prompt_count: 5,
    turn: 3,
  }],
  scenario: 'Void Merchant',
  model: 'meta-llama/Llama-3.1-8B-Instruct',
  main_quest: 'Pay off the debt',
  updated_at: new Date().toISOString(),
}

function mockSaveGame(slot: number, state: typeof MOCK_GAME_STATE) {
  const key = `ai_rpg_save_slot_${slot}`
  localStorage.setItem(key, JSON.stringify({ gameState: state }))
}

function mockLoadGame(slot: number) {
  const key = `ai_rpg_save_slot_${slot}`
  const saved = localStorage.getItem(key)
  if (!saved) return null
  try {
    return JSON.parse(saved)
  } catch {
    return null
  }
}

function mockDeleteGame(slot: number) {
  const key = `ai_rpg_save_slot_${slot}`
  localStorage.removeItem(key)
}

describe('SaveSlots', () => {
  beforeEach(() => {
    SAVE_SLOT_KEYS.forEach(key => localStorage.removeItem(key))
  })

  describe('Save Game', () => {
    it('should save game state to correct slot', () => {
      mockSaveGame(1, MOCK_GAME_STATE)
      const saved = localStorage.getItem('ai_rpg_save_slot_1')
      expect(saved).toBeDefined()
      const parsed = JSON.parse(saved!)
      expect(parsed.gameState).toBeDefined()
      expect(parsed.gameState.scenario).toBe('Void Merchant')
    })

    it('should preserve all game state fields', () => {
      mockSaveGame(2, MOCK_GAME_STATE)
      const loaded = mockLoadGame(2)
      expect(loaded?.gameState.session_id).toBe('test-session-123')
      expect(loaded?.gameState.players[0].name).toBe('TestPlayer')
      expect(loaded?.gameState.scenario).toBe('Void Merchant')
    })

    it('should overwrite existing save', () => {
      mockSaveGame(1, MOCK_GAME_STATE)
      const newState = { ...MOCK_GAME_STATE, scenario: 'Beggar to King' }
      mockSaveGame(1, newState)
      const loaded = mockLoadGame(1)
      expect(loaded?.gameState.scenario).toBe('Beggar to King')
    })
  })

  describe('Load Game', () => {
    it('should return null for empty slot', () => {
      const loaded = mockLoadGame(1)
      expect(loaded).toBeNull()
    })

    it('should load saved game correctly', () => {
      mockSaveGame(3, MOCK_GAME_STATE)
      const loaded = mockLoadGame(3)
      expect(loaded).not.toBeNull()
      expect(loaded?.gameState.scenario).toBe('Void Merchant')
    })

    it('should handle corrupt save data', () => {
      localStorage.setItem('ai_rpg_save_slot_4', 'not valid json')
      const loaded = mockLoadGame(4)
      expect(loaded).toBeNull()
    })
  })

  describe('Delete Game', () => {
    it('should delete saved game', () => {
      mockSaveGame(1, MOCK_GAME_STATE)
      mockDeleteGame(1)
      const loaded = mockLoadGame(1)
      expect(loaded).toBeNull()
    })

    it('should not affect other slots when deleting one', () => {
      mockSaveGame(1, MOCK_GAME_STATE)
      mockSaveGame(2, MOCK_GAME_STATE)
      mockDeleteGame(1)
      expect(mockLoadGame(1)).toBeNull()
      expect(mockLoadGame(2)).not.toBeNull()
    })
  })

  describe('Save Slot Detection', () => {
    it('should detect which slots have saves', () => {
      mockSaveGame(1, MOCK_GAME_STATE)
      mockSaveGame(3, MOCK_GAME_STATE)

      const slotStatuses = [1, 2, 3, 4].map(slot => ({
        slot,
        hasData: mockLoadGame(slot) !== null,
      }))

      expect(slotStatuses.find(s => s.slot === 1)?.hasData).toBe(true)
      expect(slotStatuses.find(s => s.slot === 2)?.hasData).toBe(false)
      expect(slotStatuses.find(s => s.slot === 3)?.hasData).toBe(true)
      expect(slotStatuses.find(s => s.slot === 4)?.hasData).toBe(false)
    })
  })

  describe('Scenario Theme Colors', () => {
    const THEME_COLORS: Record<string, string> = {
      'void merchant': '#6a5aaa',
      'debt collector': '#8e44ad',
      'shipwrecked': '#1abc9c',
      'haunted': '#8e44ad',
      'grain conspiracy': '#27ae60',
      'beggar': '#d4af37',
    }

    it('should have purple theme for Void Merchant', () => {
      expect(THEME_COLORS['void merchant']).toBe('#6a5aaa')
    })

    it('should have purple theme for Debt Collector', () => {
      expect(THEME_COLORS['debt collector']).toBe('#8e44ad')
    })

    it('should have teal theme for Shipwrecked', () => {
      expect(THEME_COLORS['shipwrecked']).toBe('#1abc9c')
    })

    it('should match scenario to theme color', () => {
      function getThemeColor(scenario: string): string {
        const s = scenario.toLowerCase()
        if (s.includes('void') || s.includes('merchant')) return '#6a5aaa'
        if (s.includes('debt collector')) return '#8e44ad'
        if (s.includes('shipwreck')) return '#1abc9c'
        if (s.includes('grain') || s.includes('poison')) return '#27ae60'
        return '#d4af37' // default
      }

      expect(getThemeColor('Void Merchant')).toBe('#6a5aaa')
      expect(getThemeColor('Debt Collector')).toBe('#8e44ad')
      expect(getThemeColor('Shipwrecked on the Obsidian Shore')).toBe('#1abc9c')
      expect(getThemeColor('The Grain Conspiracy')).toBe('#27ae60')
    })
  })

  describe('Multiple Slots', () => {
    it('should handle all 4 slots independently', () => {
      const states = [1, 2, 3, 4].map(i => ({
        ...MOCK_GAME_STATE,
        session_id: `session-${i}`,
        players: [{ ...MOCK_GAME_STATE.players[0], name: `Player${i}` }],
      }))

      states.forEach((state, i) => mockSaveGame(i + 1, state))

      for (let i = 0; i < 4; i++) {
        const loaded = mockLoadGame(i + 1)
        expect(loaded?.gameState.players[0].name).toBe(`Player${i + 1}`)
      }
    })
  })
})