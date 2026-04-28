import express, { Request, Response } from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.code === 'DEP0060') return
})

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// __dirname is frontend/server/. The repo's canonical .env lives at the project root,
// so we walk up two levels. Fall back to frontend/.env if a workspace puts one there.
const ROOT_ENV     = path.resolve(__dirname, '../../.env')
const FRONTEND_ENV = path.resolve(__dirname, '../.env')
dotenv.config({ path: fs.existsSync(ROOT_ENV) ? ROOT_ENV : FRONTEND_ENV })
const app        = express()
const PORT       = 3001

const PROJECT_ROOT = path.resolve(__dirname, '..')
const STATE_PATH = path.resolve(PROJECT_ROOT, 'game_state.json')
const CMD_PATH   = path.resolve(PROJECT_ROOT, 'command_queue.json')
const SETUP_PATH = path.resolve(PROJECT_ROOT, 'setup_state.json')
const ERROR_PATH = path.resolve(PROJECT_ROOT, 'last_error.json')

app.use(cors())
app.use(express.json())

// ── Free image: Pollinations.ai ────────────────────────────────────────────
// https://image.pollinations.ai/prompt/{prompt}?seed=&width=&height=&nologo=true&private=true
const POLLINATIONS_IMAGE = 'https://image.pollinations.ai/prompt'

app.post('/api/image', async (req: Request, res: Response) => {
  const { prompt, seed, width, height } = req.body as {
    prompt?: string
    seed?: number
    width?: number
    height?: number
  }
  if (!prompt) { res.status(400).json({ error: 'Missing prompt' }); return }

  const promptPreview = prompt.slice(0, 80).replace(/\s+/g, ' ')
  const startedAt = Date.now()
  console.log(`[image-call] → seed=${seed ?? 0} ${width ?? 768}x${height ?? 512} prompt="${promptPreview}…"`)
  try {
    const params = new URLSearchParams({
      seed: String(seed ?? 0),
      width: String(width ?? 768),
      height: String(height ?? 512),
      nologo: 'true',
      private: 'true',
    })
    const url = `${POLLINATIONS_IMAGE}/${encodeURIComponent(prompt)}?${params.toString()}`
    const response = await fetch(url)

    if (!response.ok) {
      const err = await response.text().catch(() => 'unknown')
      console.log(`[image-call] ✗ FAIL status=${response.status} elapsed=${Date.now() - startedAt}ms err="${err.slice(0, 200)}"`)
      res.status(response.status).json({ error: `Pollinations image error ${response.status}: ${err}` })
      return
    }

    const buffer = await response.arrayBuffer()
    console.log(`[image-call] ✓ ok bytes=${buffer.byteLength} elapsed=${Date.now() - startedAt}ms`)
    res.set('Content-Type', response.headers.get('Content-Type') ?? 'image/png')
    res.send(Buffer.from(buffer))
  } catch (e) {
    console.log(`[image-call] ✗ THROW elapsed=${Date.now() - startedAt}ms err="${String(e).slice(0, 200)}"`)
    res.status(500).json({ error: String(e) })
  }
})

// ── Free TTS: Pollinations.ai ──────────────────────────────────────────────
// https://text.pollinations.ai/{prompt}?model=openai-audio&voice=alloy
// Returns audio/mpeg directly.
const POLLINATIONS_TTS = 'https://text.pollinations.ai'

app.post('/api/tts', async (req: Request, res: Response) => {
  const { voice, text } = req.body as { voice?: string; text?: string }
  if (!text) { res.status(400).json({ error: 'Missing text' }); return }

  const textPreview = text.slice(0, 80).replace(/\s+/g, ' ')
  const startedAt = Date.now()
  console.log(`[tts-call] → voice=${voice || 'alloy'} chars=${text.length} text="${textPreview}…"`)
  try {
    const params = new URLSearchParams({ model: 'openai-audio', voice: voice || 'alloy' })
    const url = `${POLLINATIONS_TTS}/${encodeURIComponent(text)}?${params.toString()}`
    const response = await fetch(url)

    if (!response.ok) {
      const err = await response.text().catch(() => 'unknown')
      console.log(`[tts-call] ✗ FAIL status=${response.status} elapsed=${Date.now() - startedAt}ms err="${err.slice(0, 200)}"`)
      res.status(response.status).json({ error: `Pollinations TTS error ${response.status}: ${err}` })
      return
    }

    const buffer = await response.arrayBuffer()
    console.log(`[tts-call] ✓ ok bytes=${buffer.byteLength} elapsed=${Date.now() - startedAt}ms`)
    res.set('Content-Type', response.headers.get('Content-Type') ?? 'audio/mpeg')
    res.send(Buffer.from(buffer))
  } catch (e) {
    console.log(`[tts-call] ✗ THROW elapsed=${Date.now() - startedAt}ms err="${String(e).slice(0, 200)}"`)
    res.status(500).json({ error: String(e) })
  }
})

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

app.get('/api/error', (_req: Request, res: Response) => {
try {
  if (!fs.existsSync(ERROR_PATH)) { res.status(404).json({}); return }
  res.json(JSON.parse(fs.readFileSync(ERROR_PATH, 'utf-8')))
} catch (e) { res.status(500).json({}) }
})

app.delete('/api/error', (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(ERROR_PATH)) fs.unlinkSync(ERROR_PATH)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

app.delete('/api/state', (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH)
    if (fs.existsSync(SETUP_PATH)) fs.unlinkSync(SETUP_PATH)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

app.post('/api/restore', (req: Request, res: Response) => {
  const { gameState } = req.body as { gameState?: object }
  if (!gameState) { res.status(400).json({ error: 'Missing gameState' }); return }
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(gameState, null, 2))
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

app.listen(PORT, () => {
  console.log(`[bridge] http://localhost:${PORT}`)
  console.log(`[bridge] state → ${STATE_PATH}`)
  console.log(`[bridge] queue → ${CMD_PATH}`)
  console.log(`[bridge] setup → ${SETUP_PATH}`)
  console.log(`[bridge] error → ${ERROR_PATH}`)
})
