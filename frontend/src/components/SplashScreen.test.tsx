import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SplashScreen } from './SplashScreen'

vi.useFakeTimers()

describe('SplashScreen', () => {
  let onComplete: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onComplete = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Render States', () => {
    it('should render initial loading state with step 1', () => {
      render(<SplashScreen onComplete={onComplete} />)
      
      expect(screen.getByText('AI RPG')).toBeTruthy()
      expect(screen.getByText(/Loading resources/)).toBeTruthy()
      expect(screen.getByText('1 Loading resources...')).toBeTruthy()
      expect(screen.queryByText('✓ Loading resources...')).toBeNull()
    })

    it('should advance to step 2 after timer', async () => {
      render(<SplashScreen onComplete={onComplete} />)
      
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      
      expect(screen.getByText('✓ Loading resources...')).toBeTruthy()
      expect(screen.getByText('✓ Connecting to game server...')).toBeTruthy()
    })

    it('should advance to step 3 after second timer', async () => {
      render(<SplashScreen onComplete={onComplete} />)
      
      await act(async () => {
        vi.advanceTimersByTime(4000)
      })
      
      expect(screen.getByText('✓ Loading resources...')).toBeTruthy()
      expect(screen.getByText('✓ Connecting to game server...')).toBeTruthy()
      expect(screen.getByText('✓ Google Play sync...')).toBeTruthy()
    })

    it('should call onComplete after final step', async () => {
      render(<SplashScreen onComplete={onComplete} />)
      
      await act(async () => {
        vi.advanceTimersByTime(6000)
      })
      
      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('should render skip button', () => {
      render(<SplashScreen onComplete={onComplete} />)
      
      const skipBtn = screen.getByText('Skip →')
      expect(skipBtn).toBeTruthy()
    })

    it('should skip on skip button click', () => {
      render(<SplashScreen onComplete={onComplete} />)
      
      fireEvent.click(screen.getByText('Skip →'))
      
      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('should render crown glyph', () => {
      render(<SplashScreen onComplete={onComplete} />)
      
      const crown = screen.getByText('♛')
      expect(crown).toBeTruthy()
      expect(crown.className).toContain('crown-glyph--animated')
    })

    it('should render all three loading steps', () => {
      render(<SplashScreen onComplete={onComplete} />)
      
      expect(screen.getByText(/Loading resources/)).toBeTruthy()
      expect(screen.getByText(/Connecting to game server/)).toBeTruthy()
      expect(screen.getByText(/Google Play sync/)).toBeTruthy()
    })
  })

  describe('Step Progress', () => {
    it('should not mark step 1 as complete initially', () => {
      render(<SplashScreen onComplete={onComplete} />)
      
      expect(screen.getByText('1 Loading resources...')).toBeTruthy()
      expect(screen.queryByText('�� Loading resources...')).toBeNull()
    })

    it('should mark step 2 as complete when step >= 2', async () => {
      render(<SplashScreen onComplete={onComplete} />)
      
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      
      expect(screen.queryByText('2 Connecting to game server...')).toBeNull()
      expect(screen.getByText('✓ Connecting to game server...')).toBeTruthy()
    })

    it('should show active class on current step', () => {
      render(<SplashScreen onComplete={onComplete} />)
      
      const step1 = screen.getByText('1 Loading resources...')
      expect(step1.className).toContain('splash-step--active')
    })
  })

  describe('Cleanup', () => {
    it('should clear timer on unmount', async () => {
      const { unmount } = render(<SplashScreen onComplete={onComplete} />)
      
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
      
      unmount()
      
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      
      expect(onComplete).not.toHaveBeenCalled()
    })
  })
})