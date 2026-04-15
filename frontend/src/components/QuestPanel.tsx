// src/components/QuestPanel.tsx
import type { SideQuest } from '../types'

interface Props {
  mainQuest: string
  mainQuestSteps?: string[]
  sideQuests: SideQuest[]
  scenario: string
}

export function QuestPanel({ mainQuest, mainQuestSteps, sideQuests, scenario }: Props) {
  return (
    <div className="quest-panel">
      <div className="quest-scenario">{scenario}</div>

      <div className="quest-section">
        <h4 className="quest-label">♛ Main Quest</h4>
        <p className="quest-text">{mainQuest}</p>
        {mainQuestSteps && mainQuestSteps.length > 0 && (
          <ol className="quest-steps">
            {mainQuestSteps.map((step, i) => (
              <li key={i} className="quest-step">{step}</li>
            ))}
          </ol>
        )}
      </div>

      {sideQuests.length > 0 && (
        <div className="quest-section">
          <h4 className="quest-label">⚔ Side Quests</h4>
          {sideQuests.map((q, i) => (
            <div key={i} className="side-quest">
              <span className="sq-title">{q.title}</span>
              <span className="sq-desc">{q.description}</span>
              {q.steps && q.steps.length > 0 && (
                <ol className="quest-steps quest-steps--side">
                  {q.steps.map((step, j) => (
                    <li key={j} className="quest-step">{step}</li>
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
