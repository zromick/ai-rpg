// src/components/Terminal.tsx
import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import type { HistoryMessage, SideQuest, InventoryItem, SideCharacter, Location } from '../types'

const LOCAL_CMDS = new Set(['quest','sidequests','sidequest','sq','stats','inventory','inv','characters','chars','npcs','locations','locs','map','help','?'])

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
}

interface LocalMsg   { kind: 'local';   content: string }
interface PendingMsg { kind: 'pending'; content: string }
type ExtraMsg = LocalMsg | PendingMsg

// ─────────────────────────────────────────────────────────────────────────────

export function Terminal({ history, playerName, isActive, mainQuest, sideQuests,
  promptCount, totalChars, inventory, sideCharacters, locations, sendCommand }: Props) {

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const [val, setVal]         = useState('')
  const [extra, setExtra]     = useState<ExtraMsg[]>([])
  const [cmdHist, setCmdHist] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [sending, setSending] = useState(false)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [history, extra])
  useEffect(() => { if (isActive) inputRef.current?.focus() }, [isActive])

  function pushLocal(content: string) {
    setExtra(prev => [...prev, { kind: 'local', content }])
  }

  function resolveLocal(cmd: string): boolean {
    const c = cmd.trim().toLowerCase()
    if (!LOCAL_CMDS.has(c)) return false
    if (c === 'quest')
      pushLocal(`♛ MAIN QUEST\n${mainQuest}`)
    else if (c === 'sidequests' || c === 'sidequest' || c === 'sq')
      pushLocal(sideQuests.length === 0 ? '⚔ SIDE QUESTS\nNone active.' : `⚔ SIDE QUESTS\n${sideQuests.map((q,i)=>`[${i+1}] ${q.title}\n    ${q.description}`).join('\n')}`)
    else if (c === 'stats')
      pushLocal(`📊 STATS — ${playerName}\nPrompts: ${promptCount}  ·  Chars: ${totalChars}`)
    else if (c === 'inventory' || c === 'inv')
      pushLocal(inventory.length === 0 ? '🎒 INVENTORY\n(empty)' : `🎒 INVENTORY\n${inventory.map(i=>`• ${i.name} ×${i.quantity}${i.note ? '  — '+i.note : ''}`).join('\n')}`)
    else if (c === 'characters' || c === 'chars' || c === 'npcs')
      pushLocal(sideCharacters.length === 0 ? '👥 CHARACTERS\n(none yet)' : `👥 CHARACTERS\n${sideCharacters.map(c=>`• ${c.name} [${c.relation}]\n  ${c.description}`).join('\n')}`)
    else if (c === 'locations' || c === 'locs' || c === 'map')
      pushLocal(locations.length === 0 ? '🗺 LOCATIONS\n(none yet)' : `🗺 LOCATIONS\n${locations.map(l=>`• ${l.name} (turn ${l.last_visited})\n  ${l.description}`).join('\n')}`)
    else if (c === 'help' || c === '?')
      pushLocal('COMMANDS\n  quest           — main quest\n  sidequests/sq   — side quests\n  inventory/inv   — your items\n  characters/npcs — people met\n  locations/map   — places visited\n  stats           — prompt counts\n  character/char  — edit appearance (Rust terminal)\n  settings        — view/edit GM rules (⚙ button top right)\n  restart         — restart your game\n  title           — return to title\n  quit            — end game')
    return true
  }

  async function handleSubmit() {
    const text = val.trim()
    if (!text || sending) return
    setCmdHist(prev => [text, ...prev].slice(0, 50))
    setHistIdx(-1)
    setVal('')
    if (resolveLocal(text)) return
    setSending(true)
    setExtra(prev => [...prev, { kind: 'pending', content: text }])
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

  return (
    <div className={`terminal ${isActive ? 'terminal--active' : ''}`}>
      <div className="terminal-header">
        <span className="terminal-player">{playerName}</span>
        {isActive && <span className="terminal-active-badge">● ACTIVE TURN</span>}
        {sending && <span className="terminal-sending">⟳ waiting…</span>}
      </div>

      <div className="terminal-body">
        {history.length === 0 && extra.length === 0 && <p className="terminal-empty">Awaiting opening scene…</p>}

        {history.map((msg, i) => (
          <div key={`h${i}`} className={`terminal-msg terminal-msg--${msg.role}`}>
            {msg.role === 'user'
              ? <span className="terminal-prompt"><span className="prompt-symbol">{'>'}</span>{' '}<span className="prompt-text">{msg.content}</span></span>
              : <TypewriterText text={msg.content} isNew={i === history.length - 1} />
            }
          </div>
        ))}

        {extra.map((m, i) => (
          <div key={`e${i}`} className={`terminal-msg terminal-msg--${m.kind}`}>
            {m.kind === 'pending'
              ? <span className="terminal-prompt pending"><span className="prompt-symbol">{'>'}</span>{' '}<span className="prompt-text">{m.content}</span><span className="pending-dots">…</span></span>
              : <pre className="local-text">{m.content}</pre>
            }
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="terminal-input-row">
        <span className="input-prompt-symbol">{'>'}</span>
        <input ref={inputRef} className="terminal-input" type="text" value={val}
          onChange={e => setVal(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={sending ? 'Waiting for GM response…' : 'Type an action or \"help\" for a list of commands…'}
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
    // Use requestAnimationFrame-based approach to avoid timer drift cutting text
    let frame: number
    function tick() {
      const batch = 3  // print 3 chars per frame ≈ ~180 chars/sec at 60fps
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
