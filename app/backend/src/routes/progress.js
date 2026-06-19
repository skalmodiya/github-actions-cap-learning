import { Router } from 'express'
import { readFile, writeFile } from 'fs/promises'
import { PROGRESS_FILE } from '../lib/paths.js'

export const progressRouter = Router()

const DEFAULT_PROGRESS = {
  completedSteps: [],
  lastModuleId: '01-gha-basics',
  lastStepId: '',
  updatedAt: new Date().toISOString(),
}

progressRouter.get('/', async (_req, res) => {
  try {
    const raw = await readFile(PROGRESS_FILE, 'utf8')
    res.json(JSON.parse(raw))
  } catch {
    res.json(DEFAULT_PROGRESS)
  }
})

progressRouter.post('/', async (req, res) => {
  try {
    const data = { ...req.body, updatedAt: new Date().toISOString() }
    await writeFile(PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf8')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
