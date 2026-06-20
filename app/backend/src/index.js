import { existsSync } from 'fs'
import express from 'express'
import cors from 'cors'
import { executeRouter } from './routes/execute.js'
import { filesRouter } from './routes/files.js'
import { settingsRouter } from './routes/settings.js'
import { progressRouter } from './routes/progress.js'
import { llmRouter } from './routes/llm.js'
import { WORK_DIR, SHELL_EXE } from './lib/paths.js'

const app = express()
const PORT = process.env.PORT || 19230

app.use(cors())
app.use(express.json({ limit: '4mb' }))

app.use('/api/execute', executeRouter)
app.use('/api', filesRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/progress', progressRouter)
app.use('/api/llm', llmRouter)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, cwd: WORK_DIR, shell: SHELL_EXE })
})

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  console.log(`Working directory: ${WORK_DIR}`)
  console.log(`Shell: ${SHELL_EXE}`)
})
