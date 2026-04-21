import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameState } from './UseGameState'
import type { GameState, SetupState } from '../types'

const POLL_MS = 1500

const mockSetupState: SetupState = {
  phase: 'waiting',
  data: {
    models: [{ label: 'GPT-4', id: 'gpt-4' }],
    scenarios: [{ title: 'Test', description: 'A test scenario', win_conditions: 'Win', opening_scene: 'Start', user_condition: '', user_inventory: '', scenario_rules: [] }],
    common_rules: [],
  },
  updated_at: '2025-01-01T00:00:00.000Z',
}

const mockGameState: GameState = {
  session_id: 'session-1',
  scenario: 'Test Scenario',
  model: 'gpt-4',
  main_quest: 'Main Quest',
  side_quests: [],
  active_player: 'player1',
  players: [
    {
      name: 'player1',
      prompt_count: 1,
      total_chars: 100,
      last_gm_reply: 'Hello!',
      image_prompt: '',
      character_features: {} as any,
      inventory: [],
      side_characters: [],
      locations: [],
      turn: 1,
      history: [],
    },
  ],
  settings: {
    model: 'gpt-4',
    scenario_title: 'Test Scenario',
    scenario_rules: [],
    common_rules: [],
  },
  updated_at: '2025-01-01T00:00:00.000Z',
}

const mockResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
})

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  global.fetch = fetchMock
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useGameState', () => {
  describe('gameState polling', () => {
    it('fetches /api/state during active game', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(null, false, 404))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
      
      renderHook(() => useGameState())
      
      await act(async () => {
        vi.advanceTimersByTime(POLL_MS + 50)
        await Promise.resolve()
      })
      
      expect(fetchMock).toHaveBeenCalledWith('/api/state')
    })

    it('sets gameState from /api/state response', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(null, false, 404))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
      
      const { result } = renderHook(() => useGameState())
      
      await act(async () => {
        vi.advanceTimersByTime(POLL_MS + 50)
        await Promise.resolve()
      })
      
      expect(result.current.gameState).toEqual(mockGameState)
    })
  })

  describe('session reset', () => {
    it('sets gameState to null when state file gone', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(null, false, 404))
        .mockResolvedValueOnce(mockResponse(null, false, 404))
        .mockResolvedValueOnce(mockResponse(null, false, 404))
        .mockResolvedValueOnce(mockResponse(null, false, 404))
      
      const { result } = renderHook(() => useGameState())
      
      await act(async () => {
        vi.advanceTimersByTime(POLL_MS + 50)
        await Promise.resolve()
      })
      
      expect(result.current.gameState).toBeNull()
    })
  })

  describe('error handling', () => {
    it('sets error when fetch fails with network error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'))
      
      const { result } = renderHook(() => useGameState())
      
      await act(async () => {
        vi.advanceTimersByTime(10)
        await Promise.resolve()
      })
      
      expect(result.current.error).toBe('Bridge server unreachable — run: npm run start')
    })
  })

  describe('sendCommand', () => {
    it('posts player+text to /api/command', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(null, false, 404))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse({ ok: true, status: 200 }))
        .mockResolvedValueOnce(mockResponse({ ok: true }))
      
      const { result } = renderHook(() => useGameState())
      
      await act(async () => {
        vi.advanceTimersByTime(POLL_MS + 50)
        await Promise.resolve()
      })
      
      let okResult = false
      await act(async () => {
        okResult = await result.current.sendCommand('player1', 'Hello world')
      })
      
      expect(okResult).toBe(true)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/command',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player: 'player1', text: 'Hello world' }),
        },
      )
    })
  })

  describe('setup vs game', () => {
    it('loads setupState when no game running', async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url === '/api/setup') {
          return Promise.resolve(mockResponse(mockSetupState))
        }
        return Promise.resolve(mockResponse(null, false, 404))
      })
      
      const { result } = renderHook(() => useGameState())
      
      await act(async () => {
        vi.advanceTimersByTime(POLL_MS + 50)
        await Promise.resolve()
      })
      
      expect(result.current.setupState).toEqual(mockSetupState)
      expect(result.current.gameState).toBeNull()
    })

    it('shows gameState when game is running', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(null, false, 404))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
        .mockResolvedValueOnce(mockResponse(mockGameState))
      
      const { result } = renderHook(() => useGameState())
      
      await act(async () => {
        vi.advanceTimersByTime(POLL_MS + 50)
        await Promise.resolve()
      })
      
      expect(result.current.gameState).toEqual(mockGameState)
    })
  })
})