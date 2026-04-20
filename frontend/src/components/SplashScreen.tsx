import { useState, useEffect } from 'react'

interface Props {
  onComplete: () => void
}

export function SplashScreen({ onComplete }: Props) {
  const [step, setStep] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step < 3) {
        setStep(step + 1)
      } else {
        onComplete()
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [step, onComplete])

  return (
    <div className="splash">
      <div className="splash-inner">
        <div className="crown-glyph crown-glyph--animated">♛</div>
        <h1 className="splash-title">AI RPG</h1>
        
        <div className="splash-steps">
          <div className={`splash-step ${step >= 1 ? 'splash-step--active' : ''}`}>
            {step >= 1 ? '✓' : '1'} Loading resources...
          </div>
          <div className={`splash-step ${step >= 2 ? 'splash-step--active' : ''}`}>
            {step >= 2 ? '✓' : '2'} Connecting to game server...
          </div>
          <div className={`splash-step ${step >= 3 ? 'splash-step--active' : ''}`}>
            {step >= 3 ? '✓' : '3'} Google Play sync...
          </div>
        </div>

        <button className="splash-skip-btn" onClick={onComplete}>
          Skip →
        </button>
      </div>
    </div>
  )
}