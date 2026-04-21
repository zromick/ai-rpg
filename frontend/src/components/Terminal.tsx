// src/components/Terminal.tsx
import { useEffect, useRef, useState, KeyboardEvent, ReactNode } from 'react'
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
  'title','t',
  'restart','r',
  'delete','del',
])

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
  characterColoringEnabled: boolean
  locationColoringEnabled: boolean
sendCommand: (player: string, text: string) => Promise<boolean>
  onOpenSettings: () => void
  onTitle: () => void
  onRestart: () => void
  onDelete: () => void
  startTime?: string
  currentTime?: string
  endTime?: string
  currentNickname?: string
  nicknames?: string[]
  isGameLoading?: boolean
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
  promptCount, totalChars, inventory, sideCharacters, locations,
  characterColoringEnabled, locationColoringEnabled, sendCommand,
  onOpenSettings, onTitle, onRestart, onDelete, startTime, currentTime, endTime,
  currentNickname, nicknames: _nicknames, isGameLoading }: Props) {

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const [val, setVal]                     = useState('')
  const [extra, setExtra]                 = useState<ExtraMsg[]>([])
  const [cmdHist, setCmdHist]             = useState<string[]>([])
  const [histIdx, setHistIdx]             = useState(-1)
  const [sending, setSending]             = useState(false)
  const [confirmAction, setConfirmAction] = useState<'restart' | 'title' | 'delete' | null>(null)
  const prevHistLen = useRef(history.length)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [history, extra])
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.click()
    }
  }, [isActive])

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
    // Use history.length + 1 to always push to the very bottom
    setExtra(prev => [...prev, { kind: 'local', content, afterIndex: history.length + 1 }])
  }

  function resolveLocal(cmd: string): boolean {
    const c = cmd.trim().toLowerCase()
    if (c === 'title' || c === 't') {
      setConfirmAction('title')
      return true
    }
    if (c === 'restart' || c === 'r') {
      setConfirmAction('restart')
      return true
    }
    if (!LOCAL_CMDS.has(c)) return false
    if (c === 'quest' || c === 'q')
      pushLocal(`♛ MAIN QUEST\n${mainQuest}`)
    else if (c === 'sidequests' || c === 'sidequest' || c === 'sq')
      pushLocal(sideQuests.length === 0 ? '⚔ SIDE QUESTS\nNone active.' : `⚔ SIDE QUESTS\n${sideQuests.map((q,i)=>`[${i+1}] ${q.title}\n    ${q.description}`).join('\n')}`)
    else if (c === 'stats' || c === 's') {
      const lines = [`📊 STATS — ${playerName}`, `Total Prompts: ${promptCount}`, `Total Chars: ${totalChars}`, `Start Time: ${startTime || '-'}`, `Current Time: ${currentTime || '-'}`, `End Time: ${endTime || '-'}`]
      if (history.length > 0) {
        lines.push('', '--- Prompt History ---')
        history.forEach((msg, i) => {
          if (msg.role === 'user') {
            const content = msg.content.length > 60 ? msg.content.slice(0, 60) + '...' : msg.content
            lines.push(`[${i + 1}] ${content} (${msg.content.length} chars)`)
          }
        })
      }
      pushLocal(lines.join('\n'))
    }
    else if (c === 'inventory' || c === 'inv')
      pushLocal(inventory.length === 0 ? '🎒 INVENTORY\n(empty)' : `🎒 INVENTORY\n${inventory.map(i=>`• ${i.name} ×${i.quantity}${i.note ? '  — '+i.note : ''}`).join('\n')}`)
    else if (c === 'npcs' || c === 'n' || c === 'characters' || c === 'chars')
      pushLocal(sideCharacters.length === 0 ? '👥 CHARACTERS\n(none yet)' : `👥 CHARACTERS\n${sideCharacters.map(c=>`• ${c.name} [${c.relation}]\n  ${c.description}`).join('\n')}`)
    else if (c === 'locations' || c === 'locs' || c === 'map')
      pushLocal(locations.length === 0 ? '🗺 LOCATIONS\n(none yet)' : `🗺 LOCATIONS\n${locations.map(l=>`• ${l.name} (turn ${l.last_visited})\n  ${l.description}`).join('\n')}`)
    else if (c === 'settings' || c === 'se') {
      console.log('settings/se command triggered, calling onOpenSettings')
      onOpenSettings()
      return true
    }
    else if (c === 'delete' || c === 'del')
      setConfirmAction('delete')
    else if (c === 'help' || c === '?')
      pushLocal('COMMANDS\n  quest/q         — main quest\n  sidequests/sq   — side quests\n  inventory/inv   — your items\n  npcs/n          — people met\n  locations/map   — places visited\n  stats/s         — prompt counts\n  settings/se     — view/edit GM rules\n  restart/r       — restart your game\n  delete/del      — delete character and save\n  title/t         — return to title')
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
      } else if (confirmAction === 'delete') {
        pushLocal('Deleting character and returning to title screen...')
        onDelete()
      }
    } else {
      pushLocal('Cancelled.')
    }
    setConfirmAction(null)
  }

  async function handleSubmit() {
    const text = val.trim()
    console.log('handleSubmit called with:', text)
    if (!text || sending || isGameLoading) return
    if (isGameLoading) {
      pushLocal('Loading game... please wait')
      return
    }
    setCmdHist(prev => [text, ...prev].slice(0, 50))
    setHistIdx(-1)
    setVal('')
    if (confirmAction) { handleConfirm(text); return }
    if (resolveLocal(text)) {
      console.log('resolveLocal returned true')
      return
    }
    console.log('Calling sendCommand with:', playerName, text)
    setSending(true)
    setExtra(prev => [...prev, { kind: 'pending', content: text, afterIndex: history.length }])
    const ok = await sendCommand(playerName, text)
    console.log('sendCommand result:', ok)
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
      : isGameLoading
        ? 'Loading game... please wait'
        : 'Type an action or "help" for a list of commands…'

  return (
    <div className={`terminal ${isActive ? 'terminal--active' : ''}`}>
      <div className="terminal-header">
        <span className="terminal-player">{playerName}</span>
        {currentNickname && currentNickname !== playerName && <span className="terminal-nickname"> · {currentNickname}</span>}
        {isActive && <span className="terminal-active-badge">● ACTIVE TURN</span>}
        {sending && <span className="terminal-sending">⟳ waiting…</span>}
      </div>

      <div className="terminal-body">
        {renderItems.length === 0 && <p className="terminal-empty">Awaiting opening scene…</p>}

        {renderItems.map((item, i) => {
          if (item.type === 'history') {
            // Skip the "Begin the game" prompt from showing
            if (item.msg.role === 'user' && item.msg.content.startsWith('Begin the game')) return null
            return (
              <div key={item.key} className={`terminal-msg terminal-msg--${item.msg.role}`}>
                {item.msg.role === 'user'
                  ? <span className="terminal-prompt"><span className="prompt-symbol">{'>'}</span>{' '}<span className="prompt-text">{item.msg.content}</span></span>
                  : <TypewriterText text={item.msg.content} isNew={i === renderItems.length - 1 && item.msg.role === 'assistant'} characters={characterColoringEnabled ? sideCharacters : []} locations={locationColoringEnabled ? locations : []} />
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
              {`Type yes/y or no/n to confirm ${confirmAction}…`}
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

// Highlight character/location names in GM text
function highlightNames(text: string, characters: SideCharacter[], locations: Location[]): ReactNode {
  // Build list of names to highlight with their colors
  const highlights: Array<{ name: string; color: string | undefined }> = []

  for (const c of characters) {
    if (c.name) {
      highlights.push({ name: c.name, color: c.outline_color })
      // Also highlight first name and last name separately
      const parts = c.name.split(/\s+/)
      if (parts.length > 1) {
        highlights.push({ name: parts[0], color: c.outline_color })
        highlights.push({ name: parts[parts.length - 1], color: c.outline_color })
      }
    }
  }
  for (const l of locations) {
    if (l.name) {
      highlights.push({ name: l.name, color: l.outline_color })
    }
  }

  // Sort by length (longest first) to match longer names first
  highlights.sort((a, b) => b.name.length - a.name.length)

  // Remove duplicates and substrings that would conflict
  const seen = new Set<string>()
  const uniqueHighlights = highlights.filter(h => {
    const lower = h.name.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })

  // Build regex pattern
  const names = uniqueHighlights.map(h => h.name).filter(n => n.length > 1)
  if (names.length === 0) return text

  const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')

  // Split and rebuild with highlights
  const parts: React.ReactNode[] = []
  let lastEnd = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastEnd) {
      parts.push(text.slice(lastEnd, match.index))
    }
    const matchedName = match[0]
    const highlight = uniqueHighlights.find(h => h.name.toLowerCase() === matchedName.toLowerCase())
    const style: React.CSSProperties = highlight?.color
      ? { backgroundColor: `${highlight.color}20`, borderColor: highlight.color }
      : {}
    parts.push(
      <span key={match.index} className="highlighted-name" style={style} onClick={() => {
        const panel = document.querySelector('.char-panel')
        const charTab = panel?.querySelector('.char-tab:nth-child(3)') as HTMLButtonElement
        const locTab = panel?.querySelector('.char-tab:nth-child(4)') as HTMLButtonElement
        const isChar = characters.some(c => c.name.toLowerCase() === matchedName.toLowerCase())
        if (isChar && charTab) { charTab.click(); }
        else if (locTab) { locTab.click(); }
        panel?.scrollIntoView({ behavior: 'smooth' })
      }}>
        {matchedName}
      </span>
    )
    lastEnd = match.index + matchedName.length
  }

  if (lastEnd < text.length) {
    parts.push(text.slice(lastEnd))
  }

  return parts.length > 0 ? parts : text
}

// Typewriter — full highlight as text appears, then highlights appear after typewriter is done
function TypewriterText({ text, isNew, characters, locations }: { text: string; isNew: boolean; characters: SideCharacter[]; locations: Location[] }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const highlightRef = useRef<HTMLParagraphElement>(null)
  const [typewriterDone, setTypewriterDone] = useState(false)

  useEffect(() => {
    if (!isNew || !ref.current) return
    setTypewriterDone(false)
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
      if (i < chars.length) {
        frame = requestAnimationFrame(tick)
      } else {
        setTypewriterDone(true)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text, isNew])

  if (isNew && !typewriterDone) return <p className="gm-text" ref={ref} />
  return <p className="gm-text" ref={highlightRef}>{highlightNames(text, characters, locations)}</p>
}
