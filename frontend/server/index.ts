import express, { Request, Response } from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const app        = express()
const PORT       = 3001

const STATE_PATH = path.resolve(__dirname, '../game_state.json')
const CMD_PATH   = path.resolve(__dirname, '../command_queue.json')
const SETUP_PATH = path.resolve(__dirname, '../setup_state.json')

app.use(cors())
app.use(express.json())

app.get('/api/state', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(STATE_PATH)) { res.status(404).json({ error: 'No active game.' }); return }
    res.json(JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')))
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

app.get('/api/setup', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(SETUP_PATH)) { res.status(404).json({ error: 'No setup state yet.' }); return }
    res.json(JSON.parse(fs.readFileSync(SETUP_PATH, 'utf-8')))
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

app.post('/api/command', (req: Request, res: Response) => {
  const { player, text } = req.body as { player?: string; text?: string }
  if (!player || !text) { res.status(400).json({ error: 'Missing player or text' }); return }
  try {
    if (!fs.existsSync(CMD_PATH)) fs.writeFileSync(CMD_PATH, '[]')
    const q = JSON.parse(fs.readFileSync(CMD_PATH, 'utf-8')) as unknown[]
    q.push({ player: player.trim(), text: text.trim() })
    fs.writeFileSync(CMD_PATH, JSON.stringify(q))
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

app.listen(PORT, () => {
  console.log(`[bridge] http://localhost:${PORT}`)
  console.log(`[bridge] state → ${STATE_PATH}`)
  console.log(`[bridge] queue → ${CMD_PATH}`)
  console.log(`[bridge] setup → ${SETUP_PATH}`)
})
