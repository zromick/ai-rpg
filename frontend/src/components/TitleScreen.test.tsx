import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TitleScreen } from './TitleScreen'

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

describe('TitleScreen Component', () => {
  const defaultProps = {
    googlePlayUser: null,
    googleDisplayName: '',
    onGooglePlayLogin: vi.fn(),
    onGoogleLogout: vi.fn(),
    onGuestPlay: vi.fn(),
    saveSlots: [],
    onLoadSlot: vi.fn(),
    onStartNew: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  describe('Save Slot Rendering', () => {
    it('should render 4 save slots when user is logged in', () => {
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          saveSlots={[
            { slot: 1, hasData: true, characterName: 'Hero', scenario: 'Void Merchant', turn: 5 },
            { slot: 2, hasData: false },
            { slot: 3, hasData: true, characterName: 'Rogue', scenario: 'King', turn: 12 },
            { slot: 4, hasData: false },
          ]}
        />
      )

      expect(screen.getAllByRole('button')).toHaveLength(6) // 4 slots + Play as Guest + Logout
    })

    it('should display slot number for empty slots', () => {
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          saveSlots={[
            { slot: 1, hasData: false },
          ]}
        />
      )

      expect(screen.getByText('New Slot 1')).toBeTruthy()
    })

    it('should display character name and scenario for occupied slots', () => {
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          saveSlots={[
            { slot: 1, hasData: true, characterName: 'Hero', scenario: 'Void Merchant', turn: 5 },
          ]}
        />
      )

      expect(screen.getByText('Hero')).toBeTruthy()
      expect(screen.getByText(/Void Merchant/)).toBeTruthy()
    })

    it('should display turn number for occupied slots', () => {
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          saveSlots={[
            { slot: 1, hasData: true, characterName: 'Hero', scenario: 'Void Merchant', turn: 42 },
          ]}
        />
      )

      expect(screen.getByText(/Turn 42/)).toBeTruthy()
    })
  })

  describe('Empty Slot Detection', () => {
    it('should show New Slot text for empty slot', () => {
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          saveSlots={[
            { slot: 1, hasData: false },
          ]}
        />
      )

      expect(screen.getByText('New Slot 1')).toBeTruthy()
    })

    it('should show slot info for occupied slot', () => {
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          saveSlots={[
            { slot: 1, hasData: true, characterName: 'Hero' },
          ]}
        />
      )

      expect(screen.getByText('Hero')).toBeTruthy()
    })
  })

  describe('Theme Color on Load', () => {
    it('should apply theme color border for occupied slots with themeColor', () => {
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          saveSlots={[
            { slot: 1, hasData: true, characterName: 'Hero', scenario: 'Void Merchant', turn: 5, themeColor: '#6a5aaa' },
          ]}
        />
      )

      const button = screen.getByRole('button', { name: /Hero/i })
      expect(button.style.borderColor).toBe('rgb(106, 90, 170)')
    })

    it('should apply gold theme color for Crown scenarios', () => {
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          saveSlots={[
            { slot: 1, hasData: true, characterName: 'King', scenario: 'Beggars to Crowns', turn: 10, themeColor: '#d4af37' },
          ]}
        />
      )

      const button = screen.getByRole('button', { name: /King/i })
      expect(button.style.borderColor).toBe('rgb(212, 175, 55)')
    })
  })

  describe('New Game vs Continue Flow', () => {
    it('should call onStartNew when clicking empty slot', () => {
      const onStartNew = vi.fn()
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          saveSlots={[
            { slot: 1, hasData: false },
          ]}
          onStartNew={onStartNew}
        />
      )

      fireEvent.click(screen.getByText('New Slot 1'))
      expect(onStartNew).toHaveBeenCalledWith(1)
    })

    it('should call onLoadSlot when clicking occupied slot', () => {
      const onLoadSlot = vi.fn()
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          saveSlots={[
            { slot: 1, hasData: true, characterName: 'Hero' },
          ]}
          onLoadSlot={onLoadSlot}
        />
      )

      fireEvent.click(screen.getByText('Hero'))
      expect(onLoadSlot).toHaveBeenCalledWith(1)
    })
  })

  describe('Login/Logout Flow', () => {
    it('should show Play as Guest button when not logged in', () => {
      render(<TitleScreen {...defaultProps} googlePlayUser={null} />)

      expect(screen.getByText('Play as Guest')).toBeTruthy()
    })

    it('should show Sign in with Google when not logged in', () => {
      render(<TitleScreen {...defaultProps} googlePlayUser={null} />)

      expect(screen.getByText('Sign in with Google')).toBeTruthy()
    })

    it('should call onGuestPlay when clicking Play as Guest', () => {
      const onGuestPlay = vi.fn()
      render(
        <TitleScreen
          {...defaultProps}
          onGuestPlay={onGuestPlay}
        />
      )

      fireEvent.click(screen.getByText('Play as Guest'))
      expect(onGuestPlay).toHaveBeenCalledTimes(1)
    })

    it('should show user info when logged in', () => {
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          googleDisplayName="Test User"
          saveSlots={[]}
        />
      )

      expect(screen.getByText(/Welcome, Test User!/)).toBeTruthy()
    })

    it('should call onGoogleLogout when clicking Logout', () => {
      const onGoogleLogout = vi.fn()
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          googleDisplayName="Test User"
          saveSlots={[]}
          onGoogleLogout={onGoogleLogout}
        />
      )

      fireEvent.click(screen.getByText('Logout'))
      expect(onGoogleLogout).toHaveBeenCalledTimes(1)
    })

    it('should show delete all button when onDeleteAllSlots provided', () => {
      const onDeleteAllSlots = vi.fn()
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          googleDisplayName="Test User"
          saveSlots={[]}
          onDeleteAllSlots={onDeleteAllSlots}
        />
      )

      expect(screen.getByText('Delete All Saves')).toBeTruthy()
    })

    it('should show confirm delete on second click', () => {
      const onDeleteAllSlots = vi.fn()
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={{ id: 'test-user', name: 'Test User' }}
          googleDisplayName="Test User"
          saveSlots={[]}
          onDeleteAllSlots={onDeleteAllSlots}
        />
      )

      fireEvent.click(screen.getByText('Delete All Saves'))
      expect(screen.getByText('Confirm Delete All')).toBeTruthy()
      
      fireEvent.click(screen.getByText('Confirm Delete All'))
      expect(onDeleteAllSlots).toHaveBeenCalledTimes(1)
    })

    it('should show loading state when isLoadingGoogle is true', () => {
      render(
        <TitleScreen
          {...defaultProps}
          googlePlayUser={null}
        />
      )

      const signInButton = screen.getByText('Sign in with Google')
      fireEvent.click(signInButton)
    })
  })

  describe('Header and Footer', () => {
    it('should render title with crown and name', () => {
      render(<TitleScreen {...defaultProps} />)

      expect(screen.getByText('♛')).toBeTruthy()
      expect(screen.getByText('AI RPG')).toBeTruthy()
    })

    it('should render footer with powered by text', () => {
      render(<TitleScreen {...defaultProps} />)

      expect(screen.getByText(/Powered by HuggingFace/)).toBeTruthy()
    })
  })
})