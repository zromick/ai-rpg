// server/index.ts
// Bridge server — reads game_state.json written by the Rust backend and
// exposes it over HTTP so the React frontend can poll it.
//
// Run with:  npx tsx server/index.ts
// (tsx is listed in devDependencies and handles TS execution in Node)

import express, { Request, Response } from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app  = express()
const PORT = 3001

// game_state.json lives one level above frontend/
const STATE_PATH = path.resolve(__dirname, '../../game_state.json')

app.use(cors())
app.use(express.json())

// GET /api/state
app.get('/api/state', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(STATE_PATH)) {
      res.status(404).json({
        error: 'game_state.json not found. Is the Rust game running?',
      })
      return
    }
    const raw  = fs.readFileSync(STATE_PATH, 'utf-8')
    const data = JSON.parse(raw) as unknown
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.listen(PORT, () => {
  console.log(`[bridge] http://localhost:${PORT}`)
  console.log(`[bridge] state file: ${STATE_PATH}`)
})
