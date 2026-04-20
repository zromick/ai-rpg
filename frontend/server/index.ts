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

dotenv.config({ path: path.resolve(__dirname, '../.env') })
const app        = express()
const PORT       = 3001

const STATE_PATH = path.resolve(__dirname, '../game_state.json')
const CMD_PATH   = path.resolve(__dirname, '../command_queue.json')
const SETUP_PATH = path.resolve(__dirname, '../setup_state.json')
const ERROR_PATH = path.resolve(__dirname, '../last_error.json')

app.use(cors())
app.use(express.json())

const HF_API = 'https://api-inference.huggingface.co/models'
const TOKEN = process.env.HF_TOKEN ?? ''

app.post('/api/tts', async (req: Request, res: Response) => {
  const { model, text } = req.body as { model?: string; text?: string }
  if (!model || !text) { res.status(400).json({ error: 'Missing model or text' }); return }
  if (!TOKEN) { res.status(500).json({ error: 'HF API key not configured' }); return }

  try {
    const response = await fetch(`${HF_API}/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    })

    if (!response.ok) {
      const err = await response.text()
      if (response.status === 503) {
        res.status(503).json({ error: 'Model is loading. Try again in a few seconds.' })
        return
      }
      if (response.status === 401) {
        res.status(401).json({ error: 'Invalid HF API key.' })
        return
      }
      res.status(response.status).json({ error: `HF API error: ${err}` })
      return
    }

    const buffer = await response.arrayBuffer()
    res.set('Content-Type', 'audio/mpeg')
    res.send(Buffer.from(buffer))
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

const IMAGE_STYLE = 'medieval fantasy, dramatic lighting, painterly, cinematic composition, detailed, no text, no watermark, no UI'

app.post('/api/image', async (req: Request, res: Response) => {
  const { model, prompt, seed, width, height, num_inference_steps } = req.body as {
    model?: string
    prompt?: string
    seed?: number
    width?: number
    height?: number
    num_inference_steps?: number
  }
  if (!model || !prompt) { res.status(400).json({ error: 'Missing model or prompt' }); return }
  if (!TOKEN) { res.status(500).json({ error: 'HF API key not configured' }); return }

  try {
    const response = await fetch(`${HF_API}/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'X-Use-Cache': 'false',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { seed: seed ?? 0, width: width ?? 768, height: height ?? 512, num_inference_steps: num_inference_steps ?? 4 },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      res.status(response.status).json({ error: `HF API error: ${response.status}: ${err}` })
      return
    }

    const buffer = await response.arrayBuffer()
    res.set('Content-Type', 'image/png')
    res.send(Buffer.from(buffer))
  } catch (e) {
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
