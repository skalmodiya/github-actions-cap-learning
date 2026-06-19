import { Router } from 'express'
import { readFile, writeFile } from 'fs/promises'
import { SETTINGS_FILE } from '../lib/paths.js'

export const settingsRouter = Router()

const DEFAULT_SETTINGS = {
  provider: 'LiteLLM',
  baseUrl: 'http://localhost:6655',
  apiKey: '',
  model: 'anthropic--claude-4.5-sonnet',
}

settingsRouter.get('/', async (_req, res) => {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf8')
    res.json(JSON.parse(raw))
  } catch {
    res.json(DEFAULT_SETTINGS)
  }
})

settingsRouter.post('/', async (req, res) => {
  try {
    await writeFile(SETTINGS_FILE, JSON.stringify(req.body, null, 2), 'utf8')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
