import { Router } from 'express'
import { spawn, spawnSync } from 'child_process'
import { resolve } from 'path'
import { WORK_DIR, SHELL_EXE } from '../lib/paths.js'

export const executeRouter = Router()

// Kill a process and its entire child tree on Windows
function killTree(proc) {
  if (!proc || proc.killed) return
  if (process.platform === 'win32') {
    // taskkill /F /T kills the process AND all its children
    // Use pid from the spawn — this is the bash shell's PID
    try {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { windowsHide: true })
    } catch { /* ignore if already dead */ }
  } else {
    try { process.kill(-proc.pid, 'SIGTERM') } catch { proc.kill() }
  }
}

// Strip ANSI escape sequences (ESC + bracket sequences)
function stripAnsi(s) {
  // Covers: ESC[...m  ESC[...G  ESC[...H  ESC[...K  ESC[...J  ESC c  etc.
  return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
          .replace(/\x1b[()][AB012]/g, '')
          .replace(/\x1b[cDEFGHIJKLMNOPQRSTUVWXYZ[\\\]^_`]/g, '')
          .replace(/\r\n/g, '\n')  // normalise Windows line endings
          .replace(/\r/g, '\n')    // bare CR → newline (cds watch uses \r for live updates)
}

executeRouter.post('/', (req, res) => {
  const { command, cwd } = req.body
  if (!command) return res.status(400).json({ error: 'command required' })

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
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',      // respected by many CLIs including cds
      TERM: 'dumb',       // tells programs not to use terminal control codes
    },
    shell: false,
    windowsHide: true,
    // detached: false keeps the process in the same group so taskkill /T works
  })

  let finished = false

  proc.stdout.on('data', chunk => {
    const text = stripAnsi(chunk.toString())
    if (text) send('stdout', text)
  })

  proc.stderr.on('data', chunk => {
    const text = stripAnsi(chunk.toString())
    if (text) send('stderr', text)
  })

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

  res.on('close', () => {
    if (!finished) killTree(proc)
  })
})
