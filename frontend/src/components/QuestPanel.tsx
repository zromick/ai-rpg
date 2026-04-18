// src/components/QuestPanel.tsx
import { useState, useMemo } from 'react'
import type { SideQuest } from '../types'

interface Props {
  mainQuest: string
  mainQuestSteps?: string[]
  sideQuests: SideQuest[]
  history?: string[]
}

// Infer if a quest step is completed based on history
function isStepCompleted(step: string, history: string[]): boolean {
  const stepLower = step.toLowerCase()
  // Look for keywords in the step that might indicate completion
  const completionIndicators = ['completed', 'finished', 'done', 'accomplished', 'achieved', 'obtained', 'received', 'acquired', 'defeated', 'defeated', 'killed', 'destroyed', 'delivered', 'given', 'handed', 'talked to', 'spoken to', 'visited', 'arrived', 'reached', 'entered']

  for (const entry of history) {
    const entryLower = entry.toLowerCase()
    // Check if step content appears in history with completion indicator
    if (entryLower.includes(stepLower) && completionIndicators.some(ind => entryLower.includes(ind))) {
      return true
    }
    // Check for partial matches - if step mentions something that appears as completed in history
    const stepWords = stepLower.split(/\s+/).filter(w => w.length > 3)
    const matchCount = stepWords.filter(w => entryLower.includes(w)).length
    if (matchCount >= Math.min(3, stepWords.length) && completionIndicators.some(ind => entryLower.includes(ind))) {
      return true
    }
  }
  return false
}

export function QuestPanel({ mainQuest, mainQuestSteps, sideQuests, history = [] }: Props) {
  const [showSteps, setShowSteps] = useState(true)

  const mainQuestStepsWithCompletion = useMemo(() => {
    if (!mainQuestSteps) return []
    return mainQuestSteps.map(step => ({
      step,
      completed: isStepCompleted(step, history)
    }))
  }, [mainQuestSteps, history])

  const sideQuestsWithCompletion = useMemo(() => {
    return sideQuests.map(q => ({
      ...q,
      steps: (q.steps || []).map(step => ({
        step,
        completed: isStepCompleted(step, history)
      }))
    }))
  }, [sideQuests, history])

  return (
    <div className="quest-panel">
      <div className="quest-section">
        <div className="quest-header">
          <h4 className="quest-label">♛ Main Quest</h4>
          {mainQuestStepsWithCompletion.length > 0 && (
            <button className="quest-toggle" onClick={() => setShowSteps(s => !s)} title={showSteps ? 'Hide steps' : 'Show steps'}>
              [{showSteps ? '−' : '+'}]
            </button>
          )}
        </div>
        <p className="quest-text">{mainQuest}</p>
        {showSteps && mainQuestStepsWithCompletion.length > 0 && (
          <ol className="quest-steps">
            {mainQuestStepsWithCompletion.map((item, i) => (
              <li key={i} className={`quest-step ${item.completed ? 'quest-step--completed' : ''}`}>{item.step}</li>
            ))}
          </ol>
        )}
      </div>

      {sideQuests.length > 0 && (
        <div className="quest-section">
          <div className="quest-header">
            <h4 className="quest-label">⚔ Side Quests</h4>
            {sideQuests.some(q => q.steps && q.steps.length > 0) && (
              <button className="quest-toggle" onClick={() => setShowSteps(s => !s)} title={showSteps ? 'Hide steps' : 'Show steps'}>
                [{showSteps ? '−' : '+'}]
              </button>
            )}
          </div>
          {sideQuestsWithCompletion.map((q, i) => (
            <div key={i} className="side-quest">
              <span className="sq-title">{q.title}</span>
              <span className="sq-desc">{q.description}</span>
              {showSteps && q.steps.length > 0 && (
                <ol className="quest-steps quest-steps--side">
                  {q.steps.map((item, j) => (
                    <li key={j} className={`quest-step ${item.completed ? 'quest-step--completed' : ''}`}>{item.step}</li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
