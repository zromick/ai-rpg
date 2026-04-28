// src/components/Terminal.tsx
import { useEffect, useRef, useState, KeyboardEvent, ReactNode } from 'react'
import type { HistoryMessage, SideQuest, InventoryItem, SideCharacter, Location } from '../types'
import { isStopword } from '../highlightStopwords'

const LOCAL_CMDS = new Set([
  'quest','q',
  'sidequests','sidequest','sq',
  'stats','s',
  'inventory','inv',
  'npcs','n','characters','chars',
  'locations','locs','map',
  'settings','se',
  'help','?','h',
  'title','t',
  'restart','r',
  'delete','del',
  // assistant/a is forwarded to the backend, but we still intercept it here
  // so we can surface immediate "Asking…" feedback (the Rust handler doesn't
  // echo a user message back, so the default pending-entry path would stall).
  'assistant','a',
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
  /** AI Assistant: the three context-aware actions Rust most recently
   *  suggested for the player. Empty when none are pending. Selecting 1/2/3
   *  acts on them; 4 requests fresh suggestions; 'assistant' / 'a' triggers
   *  on demand. */
  assistantOptions?: string[]
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
  currentNickname, nicknames: _nicknames, isGameLoading, assistantOptions }: Props) {

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const [val, setVal]                     = useState('')
  const [extra, setExtra]                 = useState<ExtraMsg[]>([])
  const [cmdHist, setCmdHist]             = useState<string[]>([])
  const [histIdx, setHistIdx]             = useState(-1)
  const [sending, setSending]             = useState(false)
  const [confirmAction, setConfirmAction] = useState<'restart' | 'title' | 'delete' | null>(null)
  const [assistantPending, setAssistantPending] = useState(false)
  const prevHistLen = useRef(history.length)
  const prevAssistantOptionsRef = useRef<string[] | undefined>(assistantOptions)

  // Clear the "Asking the AI…" indicator the moment the backend writes a
  // fresh assistant_options array (even an empty one — empty means the call
  // ran and the snackbar is showing the failure).
  useEffect(() => {
    const prev = prevAssistantOptionsRef.current
    const curr = assistantOptions
    const prevLen = prev?.length ?? 0
    const currLen = curr?.length ?? 0
    if (assistantPending && (currLen > 0 || (prev !== curr && currLen === 0 && prevLen > 0))) {
      setAssistantPending(false)
    }
    prevAssistantOptionsRef.current = curr
  }, [assistantOptions, assistantPending])

  // Safety net: if no response in 12s, drop the indicator so the input stays
  // usable. The snackbar should already be showing the failure by then.
  useEffect(() => {
    if (!assistantPending) return
    const t = setTimeout(() => setAssistantPending(false), 12000)
    return () => clearTimeout(t)
  }, [assistantPending])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [history, extra])

  // Window-scoped event the GameStartSplash dispatches when the player clicks
  // one of the suggested first moves. Pre-fills the input without sending so
  // the player can edit before pressing Enter.
  useEffect(() => {
    const onPreload = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail
      if (detail?.text) {
        setVal(detail.text)
        inputRef.current?.focus()
      }
    }
    window.addEventListener('preload-terminal-input', onPreload as EventListener)
    return () => window.removeEventListener('preload-terminal-input', onPreload as EventListener)
  }, [])
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
    let c = cmd.trim().toLowerCase()
    // Remove leading slash if present
    if (c.startsWith('/')) {
      c = c.slice(1)
    }
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
        // Number only the user prompts the player actually typed — skip both
        // assistant turns (so the counter doesn't jump 1, 3, 5...) and the
        // synthetic "Begin the game…" intro that the GM is bootstrapped with.
        const userPrompts = history.filter(m =>
          m.role === 'user' && !m.content.startsWith('Begin the game')
        )
        if (userPrompts.length > 0) {
          lines.push('', '--- Prompt History ---')
          userPrompts.forEach((msg, i) => {
            const content = msg.content.length > 60 ? msg.content.slice(0, 60) + '...' : msg.content
            lines.push(`[${i + 1}] ${content} (${msg.content.length} chars)`)
          })
        }
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
      onOpenSettings()
      return true
    }
    else if (c === 'delete' || c === 'del')
      setConfirmAction('delete')
    else if (c === 'help' || c === '?' || c === 'h')
      pushLocal('COMMANDS\n  assistant/a     — ask the AI for 3 suggested actions\n  delete/del      — delete character and save\n  help/h/?        — show this help\n  inventory/inv   — your items\n  locations/map   — places visited\n  npcs/n          — people met\n  quest/q         — main quest\n  restart/r       — restart your game\n  settings/se     — view/edit GM rules\n  sidequests/sq   — side quests\n  stats/s         — prompt counts\n  title/t         — return to title')
    else if (c === 'assistant' || c === 'a') {
      // Forward to the Rust backend so it can populate `assistant_options`.
      // We track the pending state in `assistantPending` (instead of a
      // permanent local entry) so the indicator clears automatically when
      // assistantOptions updates or the safety-net timeout fires.
      setAssistantPending(true)
      void sendCommand(playerName, 'assistant')
    }
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
      return
    }
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
  // Skip duplicate consecutive assistant messages.
  //
  // We compare on a normalised form (lowercase, whitespace stripped) so a
  // trailing-space difference between two GM replies doesn't defeat the
  // dedup. The Rust-side dedup already trims most exact duplicates, but the
  // model occasionally emits two near-identical replies in a row and users
  // saw the same passage rendered twice.
  const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  const renderItems: RenderItem[] = []
  let extraIdx = 0
  let lastAssistantNorm = ''
  for (let i = 0; i < history.length; i++) {
    if (history[i].role === 'assistant') {
      const n = normalize(history[i].content)
      if (n === lastAssistantNorm) continue
      lastAssistantNorm = n
    }
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

        {assistantPending && (!assistantOptions || assistantOptions.length === 0) && (
          <div className="terminal-msg terminal-msg--pending">
            <span className="terminal-prompt pending">
              <span className="prompt-symbol">{'>'}</span>{' '}
              <span className="prompt-text">✦ Asking the AI for suggestions</span>
              <span className="pending-dots">…</span>
            </span>
          </div>
        )}

        {assistantOptions && assistantOptions.length > 0 && !confirmAction && (
          <div className="terminal-msg terminal-msg--local terminal-msg--assistant">
            <div className="assistant-card">
              <div className="assistant-card-header">✦ ASSISTANT — Suggested Moves</div>
              <p className="assistant-card-hint">Click an option to load it into the command box, then edit and press Enter to send.</p>
              <ul className="assistant-card-options">
                {assistantOptions.map((opt, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="assistant-card-option"
                      onClick={() => {
                        setVal(opt)
                        inputRef.current?.focus()
                      }}
                      title="Load this move into the command box"
                    >
                      <span className="assistant-card-num">{i + 1}</span>
                      <span className="assistant-card-text">{opt}</span>
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    className="assistant-card-option assistant-card-option--more"
                    onClick={() => {
                      setAssistantPending(true)
                      void sendCommand(playerName, 'assistant')
                    }}
                    title="Ask the AI for three different suggestions"
                  >
                    <span className="assistant-card-num">4</span>
                    <span className="assistant-card-text">Suggest three different options</span>
                  </button>
                </li>
              </ul>
            </div>
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

// Highlight character/location names in GM text.
//
// Each highlight is tagged with a `kind` so click routing can pick the right
// tab in the right pane deterministically — without re-checking the matched
// substring against the lists, which used to misclassify when a character
// name and a location name overlapped (e.g. "Aldric" + "Aldric's Tavern").
//
// We also drop common English stopwords ("The", "You", "I", ...) so a stale
// extraction can't poison the highlighter.
type HighlightKind = 'character' | 'location'
interface Highlight { name: string; color: string | undefined; kind: HighlightKind }

function highlightNames(text: string, characters: SideCharacter[], locations: Location[]): ReactNode {
  const highlights: Highlight[] = []

  for (const c of characters) {
    if (!c.name) continue
    highlights.push({ name: c.name, color: c.outline_color, kind: 'character' })
    const parts = c.name.split(/\s+/)
    if (parts.length > 1) {
      // First / last names inherit the character's color and kind.
      highlights.push({ name: parts[0], color: c.outline_color, kind: 'character' })
      highlights.push({ name: parts[parts.length - 1], color: c.outline_color, kind: 'character' })
    }
  }
  for (const l of locations) {
    if (l.name) highlights.push({ name: l.name, color: l.outline_color, kind: 'location' })
  }

  // Longest first so "Aldric Shadowmere" beats "Aldric".
  highlights.sort((a, b) => b.name.length - a.name.length)

  // Drop stopwords, single chars, and case-insensitive duplicates (keeping
  // the first kept entry, which is the longest match for that lowercased
  // form thanks to the sort above).
  const seen = new Set<string>()
  const unique: Highlight[] = []
  for (const h of highlights) {
    if (isStopword(h.name)) continue
    const lower = h.name.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    unique.push(h)
  }

  if (unique.length === 0) return text

  const escaped = unique.map(h => h.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')

  const parts: React.ReactNode[] = []
  let lastEnd = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastEnd) parts.push(text.slice(lastEnd, match.index))
    const matchedName = match[0]
    const highlight = unique.find(h => h.name.toLowerCase() === matchedName.toLowerCase())
    if (!highlight) {
      parts.push(matchedName)
      lastEnd = match.index + matchedName.length
      continue
    }
    const style: React.CSSProperties = highlight.color
      ? { backgroundColor: `${highlight.color}20`, borderColor: highlight.color }
      : {}
    const kind = highlight.kind
    parts.push(
      <span key={match.index} className="highlighted-name" data-kind={kind} style={style} onClick={() => {
        const panel = document.querySelector('.char-panel')
        // Tabs are: 1=features, 2=inventory, 3=characters, 4=locations.
        const tabSelector = kind === 'character'
          ? '.char-tab:nth-child(3)'
          : '.char-tab:nth-child(4)'
        const tab = panel?.querySelector(tabSelector) as HTMLButtonElement | null
        tab?.click()
        // Surface the matched entity by name on a custom event the panel listens to.
        panel?.dispatchEvent(new CustomEvent('focus-entity', { detail: { kind, name: matchedName } }))
        panel?.scrollIntoView({ behavior: 'smooth' })
      }}>
        {matchedName}
      </span>
    )
    lastEnd = match.index + matchedName.length
  }

  if (lastEnd < text.length) parts.push(text.slice(lastEnd))

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
