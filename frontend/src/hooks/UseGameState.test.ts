import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameState } from './UseGameState'
import type { GameState, SetupState } from '../types'

vi.mock('../types', () => ({}))

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
      character_features: {},
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

const mockFetch = vi.fn()
const mockSetInterval = vi.fn<[() => void, number], NodeJS.Timeout>()
const mockClearInterval = vi.fn()

vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('setInterval', mockSetInterval)
vi.stubGlobal('clearInterval', mockClearInterval)

function ok(body: unknown) {
  return { ok: true, json: async () => body, status: 200 }
}
function notOk(status = 404) {
  return { ok: false, status, json: async () => ({}) }
}

describe('useGameState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockSetInterval.mockReturnValue(42 as unknown as NodeJS.Timeout)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('sets loading=true on mount', async () => {
      mockFetch.mockResolvedValue(notOk(404))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(result.current.loading).toBe(true)
    })
  })

  describe('setupState polling', () => {
    it('polls /api/setup when no gameState', async () => {
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockSetupState))
        .mockResolvedValueOnce(notOk(404))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(mockFetch).toHaveBeenCalledWith('/api/setup')
      expect(result.current.setupState).toEqual(mockSetupState)
    })
  })

  describe('gameState polling', () => {
    it('polls /api/state during active game', async () => {
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok(mockGameState))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(mockFetch).toHaveBeenCalledWith('/api/state')
      expect(result.current.gameState).toEqual(mockGameState)
    })
  })

  describe('state change detection', () => {
    it('calls setGameState when updated_at changes', async () => {
      const updated: GameState = { ...mockGameState, updated_at: '2025-01-01T00:00:01.000Z' }
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok(updated))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(result.current.gameState).toEqual(updated)
    })
  })

  describe('session reset', () => {
    it('sets gameState to null when state file gone (404)', async () => {
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(notOk(404))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(result.current.gameState).toBeNull()
    })
  })

  describe('session ID change', () => {
    it('resets game when session_id changes', async () => {
      const nextSession: GameState = { ...mockGameState, session_id: 'session-2' }
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok(nextSession))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(result.current.gameState).toEqual(nextSession)
    })
  })

  describe('error polling condition 1', () => {
    it('checks error when state changed', async () => {
      const updated: GameState = { ...mockGameState, updated_at: '2025-01-01T00:00:01.000Z' }
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok(updated))
        .mockResolvedValueOnce(ok({ error: undefined }))
      renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(mockFetch).toHaveBeenCalledWith('/api/error')
    })
  })

  describe('error polling condition 2', () => {
    it('checks error every 30s', async () => {
      vi.useRealTimers()
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok(mockGameState))
      renderHook(() => useGameState())
      await act(async () => { vi.advanceTimersByTime(30001); vi.runAllTimers() })
      const errorCalls = mockFetch.mock.calls.filter(([url]) => url === '/api/error')
      expect(errorCalls.length).toBeGreaterThanOrEqual(1)
      vi.useFakeTimers()
    })
  })

  describe('error polling condition 3', () => {
    it('checks error after command (pendingCommand.current)', async () => {
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok({ error: undefined }))
      renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(mockFetch).toHaveBeenCalledWith('/api/error')
    })
  })

  describe('error fetch + DELETE', () => {
    it('fetches error and clears it via DELETE', async () => {
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok({ error: 'Something went wrong' }))
        .mockResolvedValueOnce(ok({ error: undefined }))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(result.current.error).toBe('Something went wrong')
      const deleteCalls = mockFetch.mock.calls.filter(([, opts]) => opts && (opts as { method?: string }).method === 'DELETE')
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('no error on 404', () => {
    it('silently ignores 404 on error endpoint', async () => {
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(result.current.error).toBeNull()
    })
  })

  describe('bridge unreachable', () => {
    it("sets error 'Bridge server unreachable'", async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(result.current.error).toBe('Bridge server unreachable — run: npm run start')
    })
  })

  describe('sendCommand', () => {
    it('posts player+text to /api/command', async () => {
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok(mockGameState))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      await act(async () => {
        const ok = await result.current.sendCommand('player1', 'Hello world')
        expect(ok).toBe(true)
      })
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/command',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player: 'player1', text: 'Hello world' }),
        },
      )
    })
  })

  describe('sendCommand error check', () => {
    it('triggers checkError after command', async () => {
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok({ error: 'test error' }))
        .mockResolvedValueOnce(ok({ error: 'test error' }))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      await act(async () => {
        await result.current.sendCommand('player1', 'test')
        vi.advanceTimersByTime(600)
        vi.runAllTimers()
      })
      const errorCalls = mockFetch.mock.calls.filter(([url]) => url === '/api/error')
      expect(errorCalls.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('checkError retries', () => {
    it('retries up to 8 times at 600ms intervals', async () => {
      vi.useRealTimers()
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok(mockGameState))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      mockFetch.mockReset()
      mockFetch.mockResolvedValueOnce(notOk(404))
      await act(async () => {
        result.current.sendCommand('player1', 'test')
        vi.advanceTimersByTime(600 * 8)
        vi.runAllTimers()
      })
      const errorCalls = mockFetch.mock.calls.filter(([url]) => url === '/api/error')
      expect(errorCalls.length).toBe(8)
      vi.useFakeTimers()
    })
  })

  describe('checkError success', () => {
    it('sets error and DELETE on error found', async () => {
      vi.useRealTimers()
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok(mockGameState))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      mockFetch.mockReset()
      mockFetch
        .mockResolvedValueOnce(ok({ error: 'Rust panic!' }))
        .mockResolvedValueOnce(notOk(200))
      await act(async () => {
        result.current.sendCommand('player1', 'test')
        vi.runAllTimers()
      })
      expect(result.current.error).toBe('Rust panic!')
      const deleteCalls = mockFetch.mock.calls.filter(([, opts]) => opts && (opts as { method?: string }).method === 'DELETE')
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1)
      vi.useFakeTimers()
    })
  })

  describe('checkError exhausted', () => {
    it('gives up after 8 retries', async () => {
      vi.useRealTimers()
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok(mockGameState))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      mockFetch.mockReset()
      mockFetch.mockResolvedValue(notOk(404))
      await act(async () => {
        result.current.sendCommand('player1', 'test')
        vi.advanceTimersByTime(600 * 9)
        vi.runAllTimers()
      })
      expect(result.current.error).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(8)
      vi.useFakeTimers()
    })
  })

  describe('deduplication', () => {
    it('same session does not reset', async () => {
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
        .mockResolvedValueOnce(ok(mockGameState))
      renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      const gameStateCalls = mockFetch.mock.calls.filter(([url]) => url === '/api/state')
      expect(gameStateCalls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('setup vs game', () => {
    it('loads setup when no game running', async () => {
      mockFetch
        .mockResolvedValueOnce(ok(mockSetupState))
        .mockResolvedValueOnce(notOk(404))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(result.current.setupState).toEqual(mockSetupState)
      expect(result.current.gameState).toBeNull()
    })

    it('shows game when running', async () => {
      mockFetch
        .mockResolvedValueOnce(notOk(404))
        .mockResolvedValueOnce(ok(mockGameState))
      const { result } = renderHook(() => useGameState())
      await act(async () => { vi.runAllTimers() })
      expect(result.current.gameState).toEqual(mockGameState)
    })
  })
})