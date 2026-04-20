// src/components/QuestPanel.tsx
import { useState, useMemo } from 'react'
import type { SideQuest, QuestStepStatus } from '../types'

interface Props {
  mainQuest: string
  mainQuestSteps?: string[]
  mainQuestStepStatus?: QuestStepStatus[]
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

export function QuestPanel({ mainQuest, mainQuestSteps, mainQuestStepStatus, sideQuests, history = [] }: Props) {
  const [showMainSteps, setShowMainSteps] = useState(true)
  const [showSideSteps, setShowSideSteps] = useState(true)

  const mainQuestStepsWithCompletion = useMemo(() => {
    if (!mainQuestSteps) return []
    return mainQuestSteps.map((step, idx) => ({
      step,
      completed: mainQuestStepStatus?.[idx]?.completed ?? isStepCompleted(step, history)
    }))
  }, [mainQuestSteps, mainQuestStepStatus, history])

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
            <button className="quest-toggle" onClick={() => setShowMainSteps(s => !s)} title={showMainSteps ? 'Hide steps' : 'Show steps'}>
              [{showMainSteps ? '−' : '+'}]
            </button>
          )}
        </div>
        <p className="quest-text">{mainQuest}</p>
        {showMainSteps && mainQuestStepsWithCompletion.length > 0 && (
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
              <button className="quest-toggle" onClick={() => setShowSideSteps(s => !s)} title={showSideSteps ? 'Hide steps' : 'Show steps'}>
                [{showSideSteps ? '−' : '+'}]
              </button>
            )}
          </div>
          {sideQuestsWithCompletion.map((q, i) => (
            <div key={i} className="side-quest">
              <span className="sq-title">{q.title}</span>
              <span className="sq-desc">{q.description}</span>
              {showSideSteps && q.steps.length > 0 && (
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
