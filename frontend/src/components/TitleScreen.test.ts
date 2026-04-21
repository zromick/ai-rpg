import { describe, it, expect } from 'vitest'

interface SaveSlot {
  slot: number
  hasData: boolean
  characterName?: string
  scenario?: string
  turn?: number
  themeColor?: string
}

const TEST_SLOTS: SaveSlot[] = [
  { slot: 1, hasData: true, characterName: 'Hero', scenario: 'Void Merchant', turn: 5, themeColor: '#6a5aaa' },
  { slot: 2, hasData: false },
  { slot: 3, hasData: true, characterName: 'Rogue', scenario: 'Beggars to Crowns', turn: 12, themeColor: '#d4af37' },
  { slot: 4, hasData: false },
]

function getSlotThemeColor(scenario: string | undefined): string | undefined {
  if (!scenario) return undefined
  const s = scenario.toLowerCase()
  if (s.includes('void') || s.includes('merchant')) return '#6a5aaa'
  if (s.includes('king') || s.includes('crown')) return '#d4af37'
  if (s.includes('haunted')) return '#8e44ad'
  if (s.includes('ocean') || s.includes('shipwreck')) return '#1abc9c'
  return '#d4af37'
}

function hasAnySaveData(slots: SaveSlot[]): boolean {
  return slots.some(s => s.hasData)
}

function getTotalTurns(slots: SaveSlot[]): number {
  return slots.reduce((sum, s) => sum + (s.turn ?? 0), 0)
}

function sortSlotsByTurn(slots: SaveSlot[]): SaveSlot[] {
  return [...slots].sort((a, b) => (b.turn ?? 0) - (a.turn ?? 0))
}

function getLatestSave(slots: SaveSlot[]): SaveSlot | undefined {
  return slots.reduce((latest, slot) => {
    if (!slot.hasData) return latest
    if (!latest) return slot
    return (slot.turn ?? 0) > (latest.turn ?? 0) ? slot : latest
  }, undefined as SaveSlot | undefined)
}

describe('TitleScreen', () => {
  describe('Save Slots', () => {
    it('should have 4 slots', () => {
      expect(TEST_SLOTS.length).toBe(4)
    })

    it('should identify slots with data', () => {
      const slotsWithData = TEST_SLOTS.filter(s => s.hasData)
      expect(slotsWithData.length).toBe(2)
    })

    it('should detect when any save exists', () => {
      expect(hasAnySaveData(TEST_SLOTS)).toBe(true)
    })

    it('should return false for empty slots', () => {
      expect(hasAnySaveData([
        { slot: 1, hasData: false },
        { slot: 2, hasData: false },
      ])).toBe(false)
    })
  })

  describe('Theme Colors', () => {
    it('should return purple for Void Merchant', () => {
      expect(getSlotThemeColor('Void Merchant')).toBe('#6a5aaa')
    })

    it('should return gold for King scenarios', () => {
      expect(getSlotThemeColor('Beggars to Crowns')).toBe('#d4af37')
      expect(getSlotThemeColor('Lost Heir to the King')).toBe('#d4af37')
    })

    it('should return purple for haunted scenarios', () => {
      expect(getSlotThemeColor('Haunted Mansion')).toBe('#8e44ad')
    })

    it('should return teal for ocean scenarios', () => {
      expect(getSlotThemeColor('Shipwreck Survivor')).toBe('#1abc9c')
      expect(getSlotThemeColor('Ocean Depths')).toBe('#1abc9c')
    })

    it('should default to gold for unknown scenarios', () => {
      expect(getSlotThemeColor('Unknown Scenario')).toBe('#d4af37')
    })

    it('should return undefined for undefined scenario', () => {
      expect(getSlotThemeColor(undefined)).toBeUndefined()
    })
  })

  describe('Turn Calculations', () => {
    it('should calculate total turns', () => {
      expect(getTotalTurns(TEST_SLOTS)).toBe(17)  // 5 + 12
    })

    it('should return 0 for empty slots', () => {
      expect(getTotalTurns([{ slot: 1, hasData: false }])).toBe(0)
    })
  })

  describe('Slot Sorting', () => {
    it('should sort slots by turn descending', () => {
      const slots = [
        { slot: 1, hasData: true, turn: 5 },
        { slot: 2, hasData: true, turn: 20 },
        { slot: 3, hasData: true, turn: 10 },
      ]
      const sorted = sortSlotsByTurn(slots)
      expect(sorted[0].turn).toBe(20)
      expect(sorted[1].turn).toBe(10)
      expect(sorted[2].turn).toBe(5)
    })

    it('should handle missing turns', () => {
      const slots = [
        { slot: 1, hasData: true, turn: 5 },
        { slot: 2, hasData: true },
      ]
      const sorted = sortSlotsByTurn(slots)
      expect(sorted[0].turn).toBe(5)
      expect(sorted[1].turn).toBeUndefined()
    })
  })

  describe('Latest Save', () => {
    it('should find the latest save by turn', () => {
      const latest = getLatestSave(TEST_SLOTS)
      expect(latest?.characterName).toBe('Rogue')  // turn 12 > turn 5
    })

    it('should return undefined for no saves', () => {
      const latest = getLatestSave([
        { slot: 1, hasData: false },
      ])
      expect(latest).toBeUndefined()
    })
  })
})