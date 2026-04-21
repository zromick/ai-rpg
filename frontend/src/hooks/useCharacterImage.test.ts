import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { buildScenePrompt, useCharacterImage } from './useCharacterImage'
import type { ImageService } from '../types'

describe('buildScenePrompt', () => {
  const STYLE = 'medieval fantasy art, dramatic lighting, painterly, cinematic, detailed, no text, no watermark, no UI elements'

  it('should combine imagePrompt and GM reply with style', () => {
    const result = buildScenePrompt('A mysterious merchant', 'You see a hooded figure.')
    expect(result).toContain('A mysterious merchant')
    expect(result).toContain('scene: You see a hooded figure.')
    expect(result).toContain(STYLE)
  })

  it('should use only first sentence of GM reply', () => {
    const gmReply = 'First sentence. Second sentence. Third sentence.'
    const result = buildScenePrompt('Test prompt', gmReply)
    expect(result).toContain('scene: First sentence.')
    expect(result).not.toContain('Second sentence')
  })

  it('should truncate long sentences to 100 chars', () => {
    const longSentence = 'A'.repeat(150)
    const result = buildScenePrompt('Prompt', longSentence)
    expect(result).toContain('scene: A')
    expect(result.length).toBeLessThan(250)
  })

  it('should return non-empty string when imagePrompt is empty but gmReply is provided', () => {
    const result = buildScenePrompt('', 'GM reply here')
    expect(result).not.toBe('')
    expect(result).toContain('GM reply here')
  })

  it('should handle empty gmReply', () => {
    const result = buildScenePrompt('Image prompt', '')
    expect(result).toContain('Image prompt')
    expect(result).toContain(STYLE)
    expect(result).not.toContain('scene:')
  })

  it('should filter out empty scene value', () => {
    const result = buildScenePrompt('Prompt', '')
    expect(result).toContain('Prompt')
    expect(result).toContain('medieval fantasy art')
  })
})

describe('useCharacterImage', () => {
  const mockService: ImageService = {
    id: 'pollinations',
    name: 'Pollinations',
    description: 'Test image service',
    fetchImage: vi.fn().mockResolvedValue(''),
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('should return empty url initially', async () => {
    const { result } = renderHook(() =>
      useCharacterImage('prompt', 'gm reply', 1, mockService)
    )
    expect(result.current.url).toBe('')
  })

  it('should set url after fetch resolves', async () => {
    const mockFetchImage = vi.fn().mockResolvedValue('https://example.com/image.png')
    const service = { ...mockService, fetchImage: mockFetchImage }

    const { result } = renderHook(() =>
      useCharacterImage('prompt', 'gm reply', 1, service)
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(mockFetchImage).toHaveBeenCalled()
    expect(result.current.url).toBe('https://example.com/image.png')
  })

  it('should cleanup on unmount', async () => {
    const mockFetchImage = vi.fn().mockResolvedValue('https://example.com/image.png')
    const service = { ...mockService, fetchImage: mockFetchImage }

    const { result, unmount } = renderHook(() =>
      useCharacterImage('prompt', 'gm reply', 1, service)
    )

    unmount()

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(result.current).toBeDefined()
  })

  it('should not fetch when prompt is empty', () => {
    const mockFetchImage = vi.fn()
    const service = { ...mockService, fetchImage: mockFetchImage }

    renderHook(() =>
      useCharacterImage('', 'gm reply', 1, service)
    )

    expect(mockFetchImage).not.toHaveBeenCalled()
  })

  it('should not fetch when service.fetchImage is undefined', () => {
    const service = { ...mockService, fetchImage: undefined } as any

    renderHook(() =>
      useCharacterImage('prompt', 'gm reply', 1, service)
    )

    expect(mockService.fetchImage).not.toHaveBeenCalled()
  })

  it('should re-fetch when service.id changes', async () => {
    const mockFetchImage = vi.fn().mockResolvedValue('https://example.com/image.png')
    const service1 = { ...mockService, id: 'service1', fetchImage: mockFetchImage }

    const { rerender } = renderHook(
      ({ service }) => useCharacterImage('prompt', 'gm reply', 1, service),
      { initialProps: { service: service1 } }
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(mockFetchImage).toHaveBeenCalledTimes(1)

    const service2 = { ...mockService, id: 'service2', fetchImage: mockFetchImage }
    rerender({ service: service2 })

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(mockFetchImage).toHaveBeenCalledTimes(2)
  })

  it('should re-fetch when seed changes', async () => {
    const mockFetchImage = vi.fn().mockResolvedValue('https://example.com/image.png')
    const service = { ...mockService, fetchImage: mockFetchImage }

    const { rerender } = renderHook(
      ({ seed }) => useCharacterImage('prompt', 'gm reply', seed, service),
      { initialProps: { seed: 1 } }
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(mockFetchImage).toHaveBeenCalledWith(expect.any(String), 1)

    rerender({ seed: 2 })

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(mockFetchImage).toHaveBeenCalledWith(expect.any(String), 2)
  })

  it('should pass seed parameter to fetchImage', async () => {
    const mockFetchImage = vi.fn().mockResolvedValue('https://example.com/image.png')
    const service = { ...mockService, fetchImage: mockFetchImage }

    renderHook(() =>
      useCharacterImage('prompt', 'gm reply', 42, service)
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(mockFetchImage).toHaveBeenCalledWith(expect.any(String), 42)
  })

  it('should handle fetch error gracefully', async () => {
    const mockFetchImage = vi.fn().mockRejectedValue(new Error('Network error'))
    const service = { ...mockService, fetchImage: mockFetchImage }

    const { result } = renderHook(() =>
      useCharacterImage('prompt', 'gm reply', 1, service)
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(result.current.url).toBe('')
  })

  it('should build prompt from imagePrompt and gmReply', async () => {
    const mockFetchImage = vi.fn().mockResolvedValue('https://example.com/image.png')
    const service = { ...mockService, fetchImage: mockFetchImage }

    renderHook(() =>
      useCharacterImage('A dark forest', 'You hear a rustling in the bushes.', 1, service)
    )

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(mockFetchImage).toHaveBeenCalledWith(
      expect.stringContaining('A dark forest'),
      1
    )
  })
})