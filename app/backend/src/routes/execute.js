import { Router } from 'express'
import { spawn } from 'child_process'
import { resolve } from 'path'
import { WORK_DIR, SHELL_EXE } from '../lib/paths.js'

export const executeRouter = Router()

executeRouter.post('/', (req, res) => {
  const { command, cwd } = req.body
  if (!command) return res.status(400).json({ error: 'command required' })

  // Always resolve cwd against WORK_DIR so relative paths (e.g. "my-bookshop")
  // become absolute Windows paths that spawn() can use
  const workDir = cwd ? resolve(WORK_DIR, cwd) : WORK_DIR
  const start = Date.now()

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (type, data) => {
    try { res.write(`data: ${JSON.stringify({ type, data })}\n\n`) } catch { /* ignore */ }
  }

  const proc = spawn(SHELL_EXE, ['-c', command], {
    cwd: workDir,
    env: { ...process.env, FORCE_COLOR: '0' },
    shell: false,
    windowsHide: true,
  })

  let finished = false
  proc.stdout.on('data', chunk => send('stdout', chunk.toString()))
  proc.stderr.on('data', chunk => send('stderr', chunk.toString()))

  proc.on('close', code => {
    finished = true
    send('done', { exitCode: code, elapsed: Date.now() - start })
    res.end()
  })

  proc.on('error', err => {
    finished = true
    send('error', err.message)
    res.end()
  })

  // Listen on res.on('close') not req.on('close') — the request body is already
  // fully read by the time we get here, so req 'close' fires immediately.
  // res 'close' fires only when the client disconnects the SSE stream.
  res.on('close', () => {
    if (!finished && !proc.killed) proc.kill()
  })
})
