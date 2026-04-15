// src/components/QuestPanel.tsx
import { useMemo, ReactNode } from 'react'
import type { SideQuest } from '../types'

interface Props {
  mainQuest: string
  mainQuestSteps?: string[]
  sideQuests: SideQuest[]
  scenario: string
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

export function QuestPanel({ mainQuest, mainQuestSteps, sideQuests, scenario, history = [] }: Props) {
  // Compute completed steps for main quest
  const mainQuestStepsWithCompletion = useMemo(() => {
    if (!mainQuestSteps) return []
    return mainQuestSteps.map(step => ({
      step,
      completed: isStepCompleted(step, history)
    }))
  }, [mainQuestSteps, history])

  return (
    <div className="quest-panel">
      <div className="quest-scenario">{scenario}</div>

      <div className="quest-section">
        <h4 className="quest-label">♛ Main Quest</h4>
        <p className="quest-text">{mainQuest}</p>
        {mainQuestStepsWithCompletion.length > 0 && (
          <ol className="quest-steps">
            {mainQuestStepsWithCompletion.map((item, i) => (
              <li key={i} className={`quest-step ${item.completed ? 'quest-step--completed' : ''}`}>{item.step}</li>
            ))}
          </ol>
        )}
      </div>

      {sideQuests.length > 0 && (
        <div className="quest-section">
          <h4 className="quest-label">⚔ Side Quests</h4>
          {sideQuests.map((q, i) => {
            const stepsWithCompletion = (q.steps || []).map(step => ({
              step,
              completed: isStepCompleted(step, history)
            }))
            return (
              <div key={i} className="side-quest">
                <span className="sq-title">{q.title}</span>
                <span className="sq-desc">{q.description}</span>
                {stepsWithCompletion.length > 0 && (
                  <ol className="quest-steps quest-steps--side">
                    {stepsWithCompletion.map((item, j) => (
                      <li key={j} className={`quest-step ${item.completed ? 'quest-step--completed' : ''}`}>{item.step}</li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
