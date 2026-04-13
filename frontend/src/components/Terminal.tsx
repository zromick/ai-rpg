// src/components/Terminal.tsx
import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import type { HistoryMessage, SideQuest } from '../types'

// Commands that are handled locally in the UI, never forwarded to the Rust game
const LOCAL_COMMANDS = ['quest', 'sidequests', 'sidequest', 'sq', 'stats', 'help', '?']

export interface LocalCommandResult {
  type: 'quest' | 'sidequests' | 'stats' | 'help'
}

interface Props {
  history: HistoryMessage[]
  playerName: string
  isActive: boolean
  // Quest/side quest data for local command display
  mainQuest: string
  sideQuests: SideQuest[]
  promptCount: number
  totalChars: number
  // Called when user submits an action to forward to the Rust game
  // (bridge does NOT accept writes — this is displayed locally as a pending message)
  onAction?: (text: string) => void
}

interface LocalMessage {
  kind: 'local'
  content: string
}

type DisplayMessage =
  | { kind: 'history'; msg: HistoryMessage; index: number }
  | LocalMessage

export function Terminal({
  history,
  playerName,
  isActive,
  mainQuest,
  sideQuests,
  promptCount,
  totalChars,
  onAction,
}: Props) {
  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const [inputVal, setInputVal]       = useState('')
  const [localMsgs, setLocalMsgs]     = useState<LocalMessage[]>([])
  const [cmdHistory, setCmdHistory]   = useState<string[]>([])
  const [histIdx, setHistIdx]         = useState(-1)

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, localMsgs])

  // Focus input when this player's tab is active
  useEffect(() => {
    if (isActive) inputRef.current?.focus()
  }, [isActive])

  function pushLocal(content: string) {
    setLocalMsgs(prev => [...prev, { kind: 'local', content }])
  }

  function handleLocalCommand(raw: string): boolean {
    const cmd = raw.trim().toLowerCase()
    if (!LOCAL_COMMANDS.some(c => cmd === c || cmd.startsWith(c + ' '))) return false

    if (cmd === 'quest') {
      pushLocal(`♛ MAIN QUEST\n${mainQuest}`)
      return true
    }
    if (cmd === 'sidequests' || cmd === 'sidequest' || cmd === 'sq') {
      if (sideQuests.length === 0) {
        pushLocal('⚔ SIDE QUESTS\nNo side quests are active.')
      } else {
        const lines = sideQuests.map((q, i) => `[${i + 1}] ${q.title}\n    ${q.description}`).join('\n')
        pushLocal(`⚔ SIDE QUESTS\n${lines}`)
      }
      return true
    }
    if (cmd === 'stats') {
      pushLocal(`📊 STATS — ${playerName}\nPrompts: ${promptCount}  ·  Total chars: ${totalChars}`)
      return true
    }
    if (cmd === 'help' || cmd === '?') {
      pushLocal(
        `COMMANDS\n` +
        `  quest          — show main quest\n` +
        `  sidequests/sq  — show side quests\n` +
        `  stats          — show your prompt stats\n` +
        `  help / ?       — this list\n` +
        `\n` +
        `  (all other input is sent to the GM)`
      )
      return true
    }
    return false
  }

  function handleSubmit() {
    const text = inputVal.trim()
    if (!text) return

    setCmdHistory(prev => [text, ...prev].slice(0, 50))
    setHistIdx(-1)
    setInputVal('')

    if (!handleLocalCommand(text)) {
      // Not a local command — show it as a pending user message and notify parent
      onAction?.(text)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { handleSubmit(); return }
    // Arrow up/down for command history
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(histIdx + 1, cmdHistory.length - 1)
      setHistIdx(next)
      setInputVal(cmdHistory[next] ?? '')
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.max(histIdx - 1, -1)
      setHistIdx(next)
      setInputVal(next === -1 ? '' : (cmdHistory[next] ?? ''))
    }
  }

  // Merge history + local messages in display order
  const displayItems: DisplayMessage[] = [
    ...history.map((msg, index): DisplayMessage => ({ kind: 'history', msg, index })),
    ...localMsgs.map((lm): DisplayMessage => lm),
  ]

  return (
    <div className={`terminal ${isActive ? 'terminal--active' : ''}`}>
      <div className="terminal-header">
        <span className="terminal-player">{playerName}</span>
        {isActive && <span className="terminal-active-badge">● ACTIVE TURN</span>}
      </div>

      <div className="terminal-body">
        {displayItems.length === 0 && (
          <p className="terminal-empty">Awaiting opening scene…</p>
        )}
        {displayItems.map((item, i) => {
          if (item.kind === 'local') {
            return (
              <div key={`local-${i}`} className="terminal-msg terminal-msg--local">
                <pre className="local-text">{item.content}</pre>
              </div>
            )
          }
          const { msg, index } = item
          if (msg.role === 'user') {
            return (
              <div key={`h-${index}`} className="terminal-msg terminal-msg--user">
                <span className="terminal-prompt">
                  <span className="prompt-symbol">{'>'}</span>
                  <span className="prompt-text">{msg.content}</span>
                </span>
              </div>
            )
          }
          return (
            <div key={`h-${index}`} className="terminal-msg terminal-msg--assistant">
              <TypewriterText
                text={msg.content}
                isNew={index === history.length - 1}
              />
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="terminal-input-row">
        <span className="input-prompt-symbol">{'>'}</span>
        <input
          ref={inputRef}
          className="terminal-input"
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isActive ? 'Type an action or command…' : `${playerName}'s turn — switch to interact`}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
        <button
          className="terminal-send-btn"
          onClick={handleSubmit}
          disabled={!inputVal.trim()}
          title="Send (Enter)"
        >
          ↵
        </button>
      </div>
    </div>
  )
}

// Typewriter effect only on the latest GM message
function TypewriterText({ text, isNew }: { text: string; isNew: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!isNew || !ref.current) return
    const el = ref.current
    el.textContent = ''
    let i = 0
    const chars = Array.from(text)
    const id = setInterval(() => {
      if (i >= chars.length) { clearInterval(id); return }
      el.textContent += chars[i++]
    }, 12)
    return () => clearInterval(id)
  }, [text, isNew])

  if (!isNew) return <p className="gm-text">{text}</p>
  return <p className="gm-text" ref={ref} />
}
