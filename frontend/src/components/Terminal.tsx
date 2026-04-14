// src/components/Terminal.tsx
import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import type { HistoryMessage, SideQuest, InventoryItem, SideCharacter, Location } from '../types'

const LOCAL_CMDS = new Set([
  'quest','q',
  'sidequests','sidequest','sq',
  'stats','s',
  'inventory','inv',
  'npcs','n','characters','chars',
  'locations','locs','map',
  'settings','se',
  'help','?',
])

const CONFIRM_CMDS = new Set(['restart','r','title','t'])

interface Props {
  history: HistoryMessage[]
  playerName: string
  isActive: boolean
  mainQuest: string
  sideQuests: SideQuest[]
  promptCount: number
  totalChars: number
  inventory: InventoryItem[]
  sideCharacters: SideCharacter[]
  locations: Location[]
  sendCommand: (player: string, text: string) => Promise<boolean>
  onOpenSettings: () => void
  onTitle: () => void
  onRestart: () => void
}

interface LocalMsg   { kind: 'local';   content: string; afterIndex: number }
interface PendingMsg { kind: 'pending'; content: string; afterIndex: number }
type ExtraMsg = LocalMsg | PendingMsg

// Unified render item
type RenderItem =
  | { type: 'history'; msg: HistoryMessage; key: string }
  | { type: 'local';   content: string;     key: string }
  | { type: 'pending'; content: string;     key: string }

// ─────────────────────────────────────────────────────────────────────────────

export function Terminal({ history, playerName, isActive, mainQuest, sideQuests,
  promptCount, totalChars, inventory, sideCharacters, locations, sendCommand,
  onOpenSettings, onTitle, onRestart }: Props) {

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const [val, setVal]                     = useState('')
  const [extra, setExtra]                 = useState<ExtraMsg[]>([])
  const [cmdHist, setCmdHist]             = useState<string[]>([])
  const [histIdx, setHistIdx]             = useState(-1)
  const [sending, setSending]             = useState(false)
  const [confirmAction, setConfirmAction] = useState<'restart' | 'title' | null>(null)
  const prevHistLen = useRef(history.length)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [history, extra])
  useEffect(() => { if (isActive) inputRef.current?.focus() }, [isActive])

  // When history grows, remove pending extras whose text matches a new user message
  useEffect(() => {
    if (history.length > prevHistLen.current) {
      const newMessages = history.slice(prevHistLen.current)
      const newUserTexts = new Set(newMessages.filter(m => m.role === 'user').map(m => m.content))
      if (newUserTexts.size > 0) {
        setExtra(prev => {
          const cleaned: ExtraMsg[] = []
          for (const m of prev) {
            if (m.kind === 'pending' && newUserTexts.has(m.content)) {
              newUserTexts.delete(m.content) // only remove one match
              continue
            }
            cleaned.push(m)
          }
          return cleaned
        })
      }
    }
    prevHistLen.current = history.length
  }, [history])

  function pushLocal(content: string) {
    setExtra(prev => [...prev, { kind: 'local', content, afterIndex: history.length }])
  }

  function resolveLocal(cmd: string): boolean {
    const c = cmd.trim().toLowerCase()
    if (CONFIRM_CMDS.has(c)) {
      if (c === 'restart' || c === 'r') setConfirmAction('restart')
      else setConfirmAction('title')
      return true
    }
    if (!LOCAL_CMDS.has(c)) return false
    if (c === 'quest' || c === 'q')
      pushLocal(`♛ MAIN QUEST\n${mainQuest}`)
    else if (c === 'sidequests' || c === 'sidequest' || c === 'sq')
      pushLocal(sideQuests.length === 0 ? '⚔ SIDE QUESTS\nNone active.' : `⚔ SIDE QUESTS\n${sideQuests.map((q,i)=>`[${i+1}] ${q.title}\n    ${q.description}`).join('\n')}`)
    else if (c === 'stats' || c === 's')
      pushLocal(`📊 STATS — ${playerName}\nPrompts: ${promptCount}  ·  Chars: ${totalChars}`)
    else if (c === 'inventory' || c === 'inv')
      pushLocal(inventory.length === 0 ? '🎒 INVENTORY\n(empty)' : `🎒 INVENTORY\n${inventory.map(i=>`• ${i.name} ×${i.quantity}${i.note ? '  — '+i.note : ''}`).join('\n')}`)
    else if (c === 'npcs' || c === 'n' || c === 'characters' || c === 'chars')
      pushLocal(sideCharacters.length === 0 ? '👥 CHARACTERS\n(none yet)' : `👥 CHARACTERS\n${sideCharacters.map(c=>`• ${c.name} [${c.relation}]\n  ${c.description}`).join('\n')}`)
    else if (c === 'locations' || c === 'locs' || c === 'map')
      pushLocal(locations.length === 0 ? '🗺 LOCATIONS\n(none yet)' : `🗺 LOCATIONS\n${locations.map(l=>`• ${l.name} (turn ${l.last_visited})\n  ${l.description}`).join('\n')}`)
    else if (c === 'settings' || c === 'se')
      onOpenSettings()
    else if (c === 'help' || c === '?')
      pushLocal('COMMANDS\n  quest/q         — main quest\n  sidequests/sq   — side quests\n  inventory/inv   — your items\n  npcs/n          — people met\n  locations/map   — places visited\n  stats/s         — prompt counts\n  character/c     — edit appearance (Rust terminal)\n  settings/se     — view/edit GM rules\n  restart/r       — restart your game\n  title/t         — return to title')
    return true
  }

  function handleConfirm(answer: string) {
    const a = answer.trim().toLowerCase()
    if (a === 'yes' || a === 'y') {
      if (confirmAction === 'restart') {
        pushLocal('Restarting game...')
        onRestart()
      } else if (confirmAction === 'title') {
        pushLocal('Returning to title...')
        onTitle()
      }
    } else {
      pushLocal('Cancelled.')
    }
    setConfirmAction(null)
  }

  async function handleSubmit() {
    const text = val.trim()
    if (!text || sending) return
    setCmdHist(prev => [text, ...prev].slice(0, 50))
    setHistIdx(-1)
    setVal('')
    if (confirmAction) { handleConfirm(text); return }
    if (resolveLocal(text)) return
    setSending(true)
    setExtra(prev => [...prev, { kind: 'pending', content: text, afterIndex: history.length }])
    const ok = await sendCommand(playerName, text)
    setSending(false)
    if (!ok) pushLocal('⚠ Send failed — is the bridge server running?')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { void handleSubmit(); return }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const i = Math.min(histIdx + 1, cmdHist.length - 1)
      setHistIdx(i); setVal(cmdHist[i] ?? '')
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const i = Math.max(histIdx - 1, -1)
      setHistIdx(i); setVal(i === -1 ? '' : (cmdHist[i] ?? ''))
    }
  }

  // Build interleaved render items: history messages with extras inserted at correct positions
  const renderItems: RenderItem[] = []
  let extraIdx = 0
  for (let i = 0; i < history.length; i++) {
    renderItems.push({ type: 'history', msg: history[i], key: `h${i}` })
    // Insert any extras that should appear after this history index
    while (extraIdx < extra.length && extra[extraIdx].afterIndex === i + 1) {
      const m = extra[extraIdx]
      renderItems.push({ type: m.kind, content: m.content, key: `e${extraIdx}` })
      extraIdx++
    }
  }
  // Append any remaining extras (afterIndex >= history.length)
  while (extraIdx < extra.length) {
    const m = extra[extraIdx]
    renderItems.push({ type: m.kind, content: m.content, key: `e${extraIdx}` })
    extraIdx++
  }

  const placeholder = confirmAction
    ? `Type yes/y or no/n to confirm ${confirmAction}…`
    : sending
      ? 'Waiting for GM response…'
      : 'Type an action or "help" for a list of commands…'

  return (
    <div className={`terminal ${isActive ? 'terminal--active' : ''}`}>
      <div className="terminal-header">
        <span className="terminal-player">{playerName}</span>
        {isActive && <span className="terminal-active-badge">● ACTIVE TURN</span>}
        {sending && <span className="terminal-sending">⟳ waiting…</span>}
      </div>

      <div className="terminal-body">
        {renderItems.length === 0 && <p className="terminal-empty">Awaiting opening scene…</p>}

        {renderItems.map((item, i) => {
          if (item.type === 'history') {
            return (
              <div key={item.key} className={`terminal-msg terminal-msg--${item.msg.role}`}>
                {item.msg.role === 'user'
                  ? <span className="terminal-prompt"><span className="prompt-symbol">{'>'}</span>{' '}<span className="prompt-text">{item.msg.content}</span></span>
                  : <TypewriterText text={item.msg.content} isNew={i === renderItems.length - 1 && item.msg.role === 'assistant'} />
                }
              </div>
            )
          }
          if (item.type === 'pending') {
            return (
              <div key={item.key} className="terminal-msg terminal-msg--pending">
                <span className="terminal-prompt pending"><span className="prompt-symbol">{'>'}</span>{' '}<span className="prompt-text">{item.content}</span><span className="pending-dots">…</span></span>
              </div>
            )
          }
          // local
          return (
            <div key={item.key} className="terminal-msg terminal-msg--local">
              <pre className="local-text">{item.content}</pre>
            </div>
          )
        })}

        {confirmAction && (
          <div className="terminal-msg terminal-msg--local">
            <pre className="local-text">
              {confirmAction === 'restart'
                ? 'Are you sure you want to restart? Your progress will be reset. (yes/no)'
                : 'Are you sure you want to return to the title screen? Your game will end. (yes/no)'}
            </pre>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="terminal-input-row">
        <span className="input-prompt-symbol">{'>'}</span>
        <input ref={inputRef} className="terminal-input" type="text" value={val}
          onChange={e => setVal(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={sending} spellCheck={false} autoComplete="off" />
        <button className="terminal-send-btn" onClick={() => void handleSubmit()} disabled={!val.trim() || sending} title="Send (Enter)">↵</button>
      </div>
    </div>
  )
}

// Typewriter — 4ms per char (fast), full text on non-latest messages
function TypewriterText({ text, isNew }: { text: string; isNew: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!isNew || !ref.current) return
    const el = ref.current
    el.textContent = ''
    let i = 0
    const chars = Array.from(text)
    let frame: number
    function tick() {
      const batch = 3
      for (let b = 0; b < batch && i < chars.length; b++) {
        el.textContent += chars[i++]
      }
      if (i < chars.length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text, isNew])
  if (!isNew) return <p className="gm-text">{text}</p>
  return <p className="gm-text" ref={ref} />
}
