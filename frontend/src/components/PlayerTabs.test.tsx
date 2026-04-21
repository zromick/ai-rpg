import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlayerTabs } from './PlayerTabs'
import type { PlayerState } from '../types'

const createMockPlayer = (name: string, overrides: Partial<PlayerState> = {}): PlayerState => ({
  name,
  prompt_count: 5,
  turn: 1,
  total_chars: 100,
  last_gm_reply: 'Test reply',
  image_prompt: 'Test prompt',
  character_features: {
    age: '25', gender: 'Male', build: 'Athletic', height: "6'0\"",
    hair_color: 'Brown', hair_style: 'Short', eye_color: 'Blue', skin_tone: 'Fair',
    scars: '', clothing: 'Adventurer garb', expression: 'Determined', distinguishing: '',
    current_location: 'The Tavern',
  },
  inventory: [],
  side_characters: [],
  locations: [],
  history: [],
  ...overrides,
})

describe('PlayerTabs', () => {
  describe('Tab rendering', () => {
    it('should render one tab per player', () => {
      const players = [
        createMockPlayer('Alice'),
        createMockPlayer('Bob'),
        createMockPlayer('Charlie'),
      ]
      render(<PlayerTabs players={players} activePlayer="Alice" selectedPlayer="Alice" onSelect={vi.fn()} />)
      
      expect(screen.getAllByRole('button')).toHaveLength(3)
    })

    it('should render one tab for single player', () => {
      const players = [createMockPlayer('Solo')]
      render(<PlayerTabs players={players} activePlayer="Solo" selectedPlayer="Solo" onSelect={vi.fn()} />)
      
      expect(screen.getAllByRole('button')).toHaveLength(1)
    })

    it('should render tab for each player with correct name', () => {
      const players = [
        createMockPlayer('Warrior'),
        createMockPlayer('Mage'),
      ]
      render(<PlayerTabs players={players} activePlayer="Warrior" selectedPlayer="Warrior" onSelect={vi.fn()} />)
      
      expect(screen.getByText('Warrior')).toBeInTheDocument()
      expect(screen.getByText('Mage')).toBeInTheDocument()
    })

    it('should render player name in tab-name span', () => {
      const players = [createMockPlayer('Hero')]
      render(<PlayerTabs players={players} activePlayer="Hero" selectedPlayer="Hero" onSelect={vi.fn()} />)
      
      const tabName = document.querySelector('.tab-name')
      expect(tabName).toHaveTextContent('Hero')
    })
  })

  describe('Active player', () => {
    it('should apply player-tab--active class to active player', () => {
      const players = [
        createMockPlayer('Alice'),
        createMockPlayer('Bob'),
      ]
      render(<PlayerTabs players={players} activePlayer="Bob" selectedPlayer="Bob" onSelect={vi.fn()} />)
      
      const activeTab = document.querySelector('.player-tab--active')
      expect(activeTab).toBeInTheDocument()
    })

    it('should not apply player-tab--active to inactive players', () => {
      const players = [
        createMockPlayer('Alice'),
        createMockPlayer('Bob'),
      ]
      render(<PlayerTabs players={players} activePlayer="Alice" selectedPlayer="Alice" onSelect={vi.fn()} />)
      
      const activeTabs = document.querySelectorAll('.player-tab--active')
      expect(activeTabs).toHaveLength(1)
    })

    it('should highlight active player differently', () => {
      const players = [createMockPlayer('CurrentPlayer')]
      render(<PlayerTabs players={players} activePlayer="CurrentPlayer" selectedPlayer="CurrentPlayer" onSelect={vi.fn()} />)
      
      const activeTab = document.querySelector('.player-tab--active')
      expect(activeTab).toHaveTextContent('CurrentPlayer')
    })
  })

  describe('Tab switching', () => {
    it('should call onSelect with player name when tab clicked', () => {
      const onSelect = vi.fn()
      const players = [
        createMockPlayer('Alice'),
        createMockPlayer('Bob'),
      ]
      render(<PlayerTabs players={players} activePlayer="Alice" selectedPlayer="Alice" onSelect={onSelect} />)
      
      fireEvent.click(screen.getByText('Bob'))
      expect(onSelect).toHaveBeenCalledWith('Bob')
    })

    it('should call onSelect when any tab is clicked', () => {
      const onSelect = vi.fn()
      const players = [
        createMockPlayer('X'),
        createMockPlayer('Y'),
        createMockPlayer('Z'),
      ]
      render(<PlayerTabs players={players} activePlayer="X" selectedPlayer="X" onSelect={onSelect} />)
      
      fireEvent.click(screen.getByText('Y'))
      expect(onSelect).toHaveBeenCalledWith('Y')
      
      fireEvent.click(screen.getByText('Z'))
      expect(onSelect).toHaveBeenCalledWith('Z')
    })

    it('should not call onSelect for wrong player', () => {
      const onSelect = vi.fn()
      const players = [
        createMockPlayer('Alice'),
        createMockPlayer('Bob'),
      ]
      render(<PlayerTabs players={players} activePlayer="Alice" selectedPlayer="Alice" onSelect={onSelect} />)
      
      expect(onSelect).not.toHaveBeenCalled()
    })
  })

  describe('Single player', () => {
    it('should render single tab for one player', () => {
      const players = [createMockPlayer('Lone')]
      render(<PlayerTabs players={players} activePlayer="Lone" selectedPlayer="Lone" onSelect={vi.fn()} />)
      
      expect(screen.getAllByRole('button')).toHaveLength(1)
    })

    it('should still show tab for single player', () => {
      const players = [createMockPlayer('Solo')]
      render(<PlayerTabs players={players} activePlayer="Solo" selectedPlayer="Solo" onSelect={vi.fn()} />)
      
      expect(screen.getByText('Solo')).toBeInTheDocument()
    })
  })

  describe('Multi player', () => {
    it('should render all players as tabs', () => {
      const players = [
        createMockPlayer('Player1'),
        createMockPlayer('Player2'),
        createMockPlayer('Player3'),
        createMockPlayer('Player4'),
      ]
      render(<PlayerTabs players={players} activePlayer="Player1" selectedPlayer="Player1" onSelect={vi.fn()} />)
      
      expect(screen.getAllByRole('button')).toHaveLength(4)
    })

    it('should render each player name in tabs', () => {
      const players = [
        createMockPlayer('Knight'),
        createMockPlayer('Rogue'),
        createMockPlayer('Cleric'),
      ]
      render(<PlayerTabs players={players} activePlayer="Knight" selectedPlayer="Knight" onSelect={vi.fn()} />)
      
      expect(screen.getByText('Knight')).toBeInTheDocument()
      expect(screen.getByText('Rogue')).toBeInTheDocument()
      expect(screen.getByText('Cleric')).toBeInTheDocument()
    })

    it('should handle many players', () => {
      const players = Array.from({ length: 6 }, (_, i) => createMockPlayer(`Player${i + 1}`))
      render(<PlayerTabs players={players} activePlayer="Player1" selectedPlayer="Player1" onSelect={vi.fn()} />)
      
      expect(screen.getAllByRole('button')).toHaveLength(6)
    })
  })

  describe('Turn indicator', () => {
    it('should show turn indicator for active player', () => {
      const players = [createMockPlayer('Active')]
      render(<PlayerTabs players={players} activePlayer="Active" selectedPlayer="Active" onSelect={vi.fn()} />)
      
      expect(screen.getByText(/turn/)).toBeInTheDocument()
    })

    it('should not show turn indicator for inactive player', () => {
      const players = [
        createMockPlayer('Active'),
        createMockPlayer('Inactive'),
      ]
      render(<PlayerTabs players={players} activePlayer="Active" selectedPlayer="Active" onSelect={vi.fn()} />)
      
      const inactiveTab = document.querySelector('.player-tab:not(.player-tab--active)')
      expect(inactiveTab).not.toHaveTextContent(/turn/)
    })

    it('should show turn indicator with correct symbol', () => {
      const players = [createMockPlayer('TurnPlayer')]
      render(<PlayerTabs players={players} activePlayer="TurnPlayer" selectedPlayer="TurnPlayer" onSelect={vi.fn()} />)
      
      expect(screen.getByText(/↵/)).toBeInTheDocument()
    })
  })

  describe('Player name', () => {
    it('should display player name in each tab', () => {
      const players = [createMockPlayer('TestPlayer')]
      render(<PlayerTabs players={players} activePlayer="TestPlayer" selectedPlayer="TestPlayer" onSelect={vi.fn()} />)
      
      expect(screen.getByText('TestPlayer')).toBeInTheDocument()
    })

    it('should have unique names for each player', () => {
      const players = [
        createMockPlayer('Unique1'),
        createMockPlayer('Unique2'),
      ]
      render(<PlayerTabs players={players} activePlayer="Unique1" selectedPlayer="Unique1" onSelect={vi.fn()} />)
      
      expect(screen.getAllByText(/^Unique/)).toHaveLength(2)
    })
  })

  describe('Selected player styling', () => {
    it('should apply player-tab--selected to selected player', () => {
      const players = [createMockPlayer('Selected')]
      render(<PlayerTabs players={players} activePlayer="Selected" selectedPlayer="Selected" onSelect={vi.fn()} />)
      
      const selectedTab = document.querySelector('.player-tab--selected')
      expect(selectedTab).toBeInTheDocument()
    })

    it('should not apply player-tab--selected to unselected players', () => {
      const players = [
        createMockPlayer('Selected'),
        createMockPlayer('Unselected'),
      ]
      render(<PlayerTabs players={players} activePlayer="Selected" selectedPlayer="Selected" onSelect={vi.fn()} />)
      
      const unselectedTabs = document.querySelectorAll('.player-tab:not(.player-tab--selected)')
      expect(unselectedTabs).toHaveLength(1)
    })
  })

  describe('Player stats', () => {
    it('should display prompt count', () => {
      const players = [createMockPlayer('Stats', { prompt_count: 42 })]
      render(<PlayerTabs players={players} activePlayer="Stats" selectedPlayer="Stats" onSelect={vi.fn()} />)
      
      expect(screen.getByText(/42 prompts/)).toBeInTheDocument()
    })

    it('should display total chars', () => {
      const players = [createMockPlayer('Chars', { total_chars: 1234 })]
      render(<PlayerTabs players={players} activePlayer="Chars" selectedPlayer="Chars" onSelect={vi.fn()} />)
      
      expect(screen.getByText(/1234 chars/)).toBeInTheDocument()
    })
  })
})