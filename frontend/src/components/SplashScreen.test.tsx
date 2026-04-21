import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SplashScreen } from './SplashScreen'

describe('SplashScreen', () => {
  let onComplete: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    onComplete = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Render States', () => {
    it('should render title', () => {
      render(<SplashScreen onComplete={onComplete} />)
      expect(screen.getByText('AI RPG')).toBeTruthy()
    })

    it('should render loading steps', () => {
      render(<SplashScreen onComplete={onComplete} />)
      expect(screen.getByText(/Loading resources/)).toBeTruthy()
      expect(screen.getByText(/Connecting to game server/)).toBeTruthy()
      expect(screen.getByText(/Google Play sync/)).toBeTruthy()
    })

    it('should advance to step 2 after timer', async () => {
      render(<SplashScreen onComplete={onComplete} />)

      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      expect(screen.getByText(/Connecting to game server/)).toBeTruthy()
    })

    it('should advance to step 3 after second timer', async () => {
      render(<SplashScreen onComplete={onComplete} />)

      await act(async () => {
        vi.advanceTimersByTime(4000)
      })

      expect(screen.getByText(/Google Play sync/)).toBeTruthy()
    })

    it('should call onComplete after final step', async () => {
      render(<SplashScreen onComplete={onComplete} />)

      await act(async () => {
        vi.advanceTimersByTime(2000)
        await Promise.resolve()
      })
      await act(async () => {
        vi.advanceTimersByTime(2000)
        await Promise.resolve()
      })
      await act(async () => {
        vi.advanceTimersByTime(2000)
        await Promise.resolve()
      })

      expect(onComplete).toHaveBeenCalled()
    })

    it('should render skip button', () => {
      render(<SplashScreen onComplete={onComplete} />)

      const skipBtn = screen.getByText('Skip →')
      expect(skipBtn).toBeTruthy()
    })

    it('should skip on skip button click', () => {
      render(<SplashScreen onComplete={onComplete} />)

      fireEvent.click(screen.getByText('Skip →'))

      expect(onComplete).toHaveBeenCalled()
    })

    it('should render crown glyph', () => {
      render(<SplashScreen onComplete={onComplete} />)

      const crown = screen.getByText('♛')
      expect(crown).toBeTruthy()
      expect(crown.className).toContain('crown-glyph--animated')
    })
  })

  describe('Step Progress', () => {
    it('should show active class on current step', () => {
      render(<SplashScreen onComplete={onComplete} />)

      const stepText = screen.getByText(/Loading resources/)
      expect(stepText.className).toContain('splash-step--active')
    })

    it('should advance and update active step', async () => {
      render(<SplashScreen onComplete={onComplete} />)

      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      const connectingStep = screen.getByText(/Connecting to game server/)
      expect(connectingStep.className).toContain('splash-step--active')
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