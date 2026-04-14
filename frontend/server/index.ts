// server/index.ts
import express, { Request, Response } from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const app        = express()
const PORT       = 3001

const STATE_PATH = path.resolve(__dirname, '../../game_state.json')
const CMD_PATH   = path.resolve(__dirname, '../../command_queue.json')

app.use(cors())
app.use(express.json())

// ── GET /api/state ────────────────────────────────────────────────────────────
app.get('/api/state', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(STATE_PATH)) {
      res.status(404).json({ error: 'No active game. Start cargo run --release first.' })
      return
    }
    const data = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')) as unknown
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/command ─────────────────────────────────────────────────────────
// Body: { player: string, text: string }
// Appends to command_queue.json which Rust polls every 300ms.
app.post('/api/command', (req: Request, res: Response) => {
  const { player, text } = req.body as { player?: string; text?: string }
  if (!player || !text) {
    res.status(400).json({ error: 'Missing player or text' })
    return
  }

  try {
    // Initialise file if missing
    if (!fs.existsSync(CMD_PATH)) fs.writeFileSync(CMD_PATH, '[]')
    const existing = JSON.parse(fs.readFileSync(CMD_PATH, 'utf-8')) as unknown[]
    existing.push({ player: player.trim(), text: text.trim() })
    fs.writeFileSync(CMD_PATH, JSON.stringify(existing))
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.listen(PORT, () => {
  console.log(`[bridge] http://localhost:${PORT}`)
  console.log(`[bridge] state  → ${STATE_PATH}`)
  console.log(`[bridge] queue  → ${CMD_PATH}`)
})
