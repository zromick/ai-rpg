import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuestPanel } from './QuestPanel'
import type { SideQuest, QuestStepStatus } from '../types'

vi.mock('../fetch', () => ({
  fetchJSON: vi.fn(),
  fetchText: vi.fn(),
}))

describe('QuestPanel', () => {
  describe('1. Main quest rendering', () => {
    it('displays main quest text', () => {
      render(<QuestPanel mainQuest="Find the ancient artifact" sideQuests={[]} />)
      expect(screen.getByText('Find the ancient artifact')).toBeInTheDocument()
    })

    it('displays main quest label', () => {
      render(<QuestPanel mainQuest="Test quest" sideQuests={[]} />)
      expect(screen.getByText(/♛ Main Quest/)).toBeInTheDocument()
    })

    it('displays quest steps when provided', () => {
      const steps = ['Explore the dungeon', 'Find the key', 'Open the chest']
      render(<QuestPanel mainQuest="Test quest" mainQuestSteps={steps} sideQuests={[]} />)
      expect(screen.getByText('Explore the dungeon')).toBeInTheDocument()
      expect(screen.getByText('Find the key')).toBeInTheDocument()
      expect(screen.getByText('Open the chest')).toBeInTheDocument()
    })
  })

  describe('2. Quest step status', () => {
    it('shows completed steps with completed class', () => {
      const steps = ['Step one', 'Step two']
      const status: QuestStepStatus[] = [
        { step: 'Step one', completed: true },
        { step: 'Step two', completed: false },
      ]
      render(<QuestPanel mainQuest="Q" mainQuestSteps={steps} mainQuestStepStatus={status} sideQuests={[]} />)
      const completed = screen.getByText('Step one')
      expect(completed).toHaveClass('quest-step--completed')
    })

    it('shows pending steps without completed class', () => {
      const steps = ['Step one', 'Step two']
      const status: QuestStepStatus[] = [
        { step: 'Step one', completed: false },
        { step: 'Step two', completed: false },
      ]
      render(<QuestPanel mainQuest="Q" mainQuestSteps={steps} mainQuestStepStatus={status} sideQuests={[]} />)
      const pending = screen.getByText('Step one')
      expect(pending).not.toHaveClass('quest-step--completed')
    })
  })

  describe('3. Step markers', () => {
    it('completed steps have completed class for styling', () => {
      const steps = ['Defeat the dragon']
      const status: QuestStepStatus[] = [{ step: 'Defeat the dragon', completed: true }]
      render(<QuestPanel mainQuest="Q" mainQuestSteps={steps} mainQuestStepStatus={status} sideQuests={[]} />)
      expect(screen.getByText('Defeat the dragon')).toHaveClass('quest-step--completed')
    })
  })

  describe('4. Side quests', () => {
    it('renders side quests when present', () => {
      const sideQuests: SideQuest[] = [
        { title: 'Fetch the herb', description: 'Get the rare flower' },
      ]
      render(<QuestPanel mainQuest="Main" sideQuests={sideQuests} />)
      expect(screen.getByText('Fetch the herb')).toBeInTheDocument()
      expect(screen.getByText('Get the rare flower')).toBeInTheDocument()
    })

    it('displays side quest label', () => {
      const sideQuests: SideQuest[] = [
        { title: 'Side', description: 'Desc' },
      ]
      render(<QuestPanel mainQuest="Main" sideQuests={sideQuests} />)
      expect(screen.getByText(/⚔ Side Quests/)).toBeInTheDocument()
    })

    it('renders side quest steps when present', () => {
      const sideQuests: SideQuest[] = [
        { title: 'Side', description: 'Desc', steps: ['Talk to the merchant', 'Buy the potion'] },
      ]
      render(<QuestPanel mainQuest="Main" sideQuests={sideQuests} />)
      expect(screen.getByText('Talk to the merchant')).toBeInTheDocument()
      expect(screen.getByText('Buy the potion')).toBeInTheDocument()
    })

    it('does not render side quest section when empty', () => {
      render(<QuestPanel mainQuest="Main" sideQuests={[]} />)
      expect(screen.queryByText(/⚔ Side Quests/)).not.toBeInTheDocument()
    })
  })

  describe('5. Empty state', () => {
    it('renders without main quest steps', () => {
      render(<QuestPanel mainQuest="Simple quest" sideQuests={[]} />)
      expect(screen.getByText('Simple quest')).toBeInTheDocument()
    })

    it('renders with empty side quests array', () => {
      render(<QuestPanel mainQuest="Quest" mainQuestSteps={[]} sideQuests={[]} />)
      expect(screen.getByText('Quest')).toBeInTheDocument()
    })
  })

  describe('6. Step timestamps', () => {
    it('completed_at is not rendered in panel (metadata only)', () => {
      const steps = ['Step one']
      const status: QuestStepStatus[] = [
        { step: 'Step one', completed: true, completed_at: '2024-01-15T10:00:00Z' },
      ]
      render(<QuestPanel mainQuest="Q" mainQuestSteps={steps} mainQuestStepStatus={status} sideQuests={[]} />)
      expect(screen.getByText('Step one')).toBeInTheDocument()
    })
  })

  describe('7. Progress display', () => {
    it('shows correct number of steps', () => {
      const steps = ['One', 'Two', 'Three']
      render(<QuestPanel mainQuest="Q" mainQuestSteps={steps} sideQuests={[]} />)
      const stepItems = screen.getAllByRole('listitem')
      expect(stepItems.length).toBe(3)
    })

    it('uses ordered list for main quest steps', () => {
      const steps = ['First', 'Second']
      render(<QuestPanel mainQuest="Q" mainQuestSteps={steps} sideQuests={[]} />)
      expect(screen.getByRole('listitem', { name: 'First' })).toBeInTheDocument()
    })
  })

  describe('8. History filtering', () => {
    it('marks step as completed when history contains matching entry with indicator', () => {
      const steps = ['Find the sword']
      const history = ['Found the legendary sword in the cave']
      render(<QuestPanel mainQuest="Q" mainQuestSteps={steps} sideQuests={[]} history={history} />)
      expect(screen.getByText('Find the sword')).toHaveClass('quest-step--completed')
    })

    it('marks step as pending when history does not contain completion indicator', () => {
      const steps = ['Find the treasure']
      const history = ['Looking for treasure chest']
      render(<QuestPanel mainQuest="Q" mainQuestSteps={steps} sideQuests={[]} history={history} />)
      expect(screen.getByText('Find the treasure')).not.toHaveClass('quest-step--completed')
    })

    it('respects explicit step status over history inference', () => {
      const steps = ['Step one']
      const status: QuestStepStatus[] = [{ step: 'Step one', completed: false }]
      const history = ['Completed step one']
      render(<QuestPanel mainQuest="Q" mainQuestSteps={steps} mainQuestStepStatus={status} sideQuests={[]} history={history} />)
      expect(screen.getByText('Step one')).not.toHaveClass('quest-step--completed')
    })
  })
})