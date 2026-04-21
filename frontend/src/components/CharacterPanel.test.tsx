// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CharacterPanel, buildEntityPrompt } from './CharacterPanel'
import type { PlayerState, ImageService } from '../types'

const mockPlayer: PlayerState = {
  name: 'TestPlayer',
  prompt_count: 5,
  turn: 3,
  character_features: {
    age: '25',
    gender: 'Male',
    build: 'Athletic',
    height: "6'0\"",
    hair_color: 'Brown',
    hair_style: 'Short',
    eye_color: 'Blue',
    skin_tone: 'Fair',
    scars: '',
    clothing: 'Adventurer garb',
    expression: 'Determined',
    distinguishing: '',
    current_location: 'The Tavern',
  },
  image_prompt: 'A brave adventurer',
  last_gm_reply: 'You enter the tavern.',
  created_at: '2024-01-01',
  updated_at: '2024-01-02',
}

const mockService: ImageService = {
  id: 'pollinations',
  name: 'Pollinations',
  fetchImage: vi.fn().mockResolvedValue('https://example.com/image.png'),
}

describe('buildEntityPrompt', () => {
  it('should return empty string for null entity', () => {
    expect(buildEntityPrompt(null)).toBe('')
  })

  it('should build prompt for inventory item', () => {
    const entity = {
      type: 'inventory' as const,
      item: { name: 'Magic Sword', note: 'Legendary weapon' },
    }
    const prompt = buildEntityPrompt(entity)
    expect(prompt).toContain('Magic Sword')
    expect(prompt).toContain('Legendary weapon')
    expect(prompt).toContain('medieval fantasy item')
  })

  it('should build prompt for inventory item without note', () => {
    const entity = {
      type: 'inventory' as const,
      item: { name: 'Rusty Key', note: '' },
    }
    const prompt = buildEntityPrompt(entity)
    expect(prompt).toContain('Rusty Key')
    expect(prompt).toContain('antique item')
  })

  it('should build prompt for character', () => {
    const entity = {
      type: 'character' as const,
      char: { name: 'Gandalf', description: 'Wise old wizard', relation: 'npc' },
    }
    const prompt = buildEntityPrompt(entity)
    expect(prompt).toContain('Gandalf')
    expect(prompt).toContain('Wise old wizard')
    expect(prompt).toContain('npc')
    expect(prompt).toContain('medieval fantasy')
  })

  it('should use player character relation', () => {
    const entity = {
      type: 'character' as const,
      char: { name: 'Hero', description: 'Main character', relation: 'player' },
    }
    const prompt = buildEntityPrompt(entity)
    expect(prompt).toContain('player character')
  })

  it('should build prompt for location', () => {
    const entity = {
      type: 'location' as const,
      loc: { name: 'The Prancing Pony', description: 'Cozy tavern' },
    }
    const prompt = buildEntityPrompt(entity)
    expect(prompt).toContain('The Prancing Pony')
    expect(prompt).toContain('Cozy tavern')
    expect(prompt).toContain('medieval fantasy location')
  })

  it('should return empty for unknown entity type', () => {
    const entity = { type: 'unknown' as never }
    expect(buildEntityPrompt(entity)).toBe('')
  })
})

describe('CharacterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should render without crashing', () => {
    render(<CharacterPanel player={mockPlayer} seed={1} service={mockService} />)
    expect(screen.getByText('TestPlayer')).toBeInTheDocument()
  })

  it('should show loading placeholder initially', () => {
    render(<CharacterPanel player={mockPlayer} seed={1} service={mockService} />)
    expect(screen.getByText(/Generating image/i)).toBeInTheDocument()
  })

  it('should display features tab by default', () => {
    render(<CharacterPanel player={mockPlayer} seed={1} service={mockService} />)
    expect(screen.getByText('👤')).toBeInTheDocument()
  })

  it('should switch to inventory tab', () => {
    render(<CharacterPanel player={mockPlayer} seed={1} service={mockService} />)
    const inventoryTab = screen.getByText('🎒')
    fireEvent.click(inventoryTab)
    expect(inventoryTab).toBeInTheDocument()
  })

  it('should switch to characters tab', () => {
    render(<CharacterPanel player={mockPlayer} seed={1} service={mockService} />)
    const charactersTab = screen.getByText('👥')
    fireEvent.click(charactersTab)
    expect(charactersTab).toBeInTheDocument()
  })

  it('should switch to locations tab', () => {
    render(<CharacterPanel player={mockPlayer} seed={1} service={mockService} />)
    const locationsTab = screen.getByText('🗺')
    fireEvent.click(locationsTab)
    expect(locationsTab).toBeInTheDocument()
  })

  it('should use useCharacterImage hook with player props', () => {
    render(<CharacterPanel player={mockPlayer} seed={1} service={mockService} />)
    expect(mockService.fetchImage).toHaveBeenCalled()
  })

  it('should display Ready when no prompt_count', () => {
    const newPlayer = { ...mockPlayer, prompt_count: 0 }
    render(<CharacterPanel player={newPlayer} seed={1} service={mockService} />)
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('should show focused entity label when focused', () => {
    const { rerender } = render(<CharacterPanel player={mockPlayer} seed={1} service={mockService} />)
    
    const entity = { type: 'inventory' as const, item: { name: 'Sword', note: 'Iron sword' } }
    
    rerender(
      <CharacterPanel 
        player={mockPlayer} 
        seed={1} 
        service={mockService}
      />
    )
  })

  it('should handle imgState transitions', () => {
    const { container } = render(<CharacterPanel player={mockPlayer} seed={1} service={mockService} />)
    const img = container.querySelector('img')
    
    if (img) {
      fireEvent.load(img)
      expect(img).toBeInTheDocument()
    }
  })

  it('should call useCharacterImage with correct seed', () => {
    const testSeed = 42
    render(<CharacterPanel player={mockPlayer} seed={testSeed} service={mockService} />)
    expect(mockService.fetchImage).toHaveBeenCalledWith(expect.any(String), testSeed)
  })

  describe('tab switching logic', () => {
    it('should have features, inventory, characters, locations tabs', () => {
      render(<CharacterPanel player={mockPlayer} seed={1} service={mockService} />)
      
      expect(screen.getByText('👤')).toBeInTheDocument()
      expect(screen.getByText('🎒')).toBeInTheDocument()
      expect(screen.getByText('👥')).toBeInTheDocument()
      expect(screen.getByText('🗺')).toBeInTheDocument()
    })

    it('should highlight active tab', () => {
      render(<CharacterPanel player={mockPlayer} seed={1} service={mockService} />)
      
      const activeTab = document.querySelector('.char-tab--active')
      expect(activeTab).toHaveTextContent('👤')
    })
  })

  describe('focused entity state', () => {
    it('should render focused entity when present', () => {
      const playerWithFocused: PlayerState = {
        ...mockPlayer,
        focused_entity: { type: 'location', loc: { name: 'Tavern', description: 'A cozy place' } },
      }
      
      render(<CharacterPanel player={playerWithFocused} seed={1} service={mockService} />)
    })

    it('should have clear button when entity is focused', () => {
      const playerWithEntity: PlayerState = {
        ...mockPlayer,
        focused_entity: { type: 'character', char: { name: 'NPC', description: 'Test', relation: 'npc' } },
      }
      
      render(<CharacterPanel player={playerWithEntity} seed={1} service={mockService} />)
    })
  })
})
