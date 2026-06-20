import { Router } from 'express'
import { readFile, writeFile, mkdir, readdir } from 'fs/promises'
import { watch } from 'fs'
import { resolve, extname, dirname } from 'path'
import { WORK_DIR } from '../lib/paths.js'

export const filesRouter = Router()

function safePath(p) {
  if (!p) throw new Error('path required')
  const normalised = p.replace(/\//g, '\\')
  const resolved = resolve(WORK_DIR, normalised.replace(/^[\\/]/, ''))
  const workDirNorm = resolve(WORK_DIR)
  if (!resolved.startsWith(workDirNorm)) {
    throw new Error('Path outside working directory')
  }
  return resolved
}

// GET /api/file?path=...
filesRouter.get('/file', async (req, res) => {
  try {
    const fullPath = safePath(req.query.path)
    const content = await readFile(fullPath, 'utf8')
    res.json({ content, path: req.query.path })
  } catch (err) {
    const status = err.message.includes('outside') ? 403
      : err.code === 'ENOENT' ? 404 : 500
    res.status(status).json({ error: err.message })
  }
})

// POST /api/file  { path, content }
filesRouter.post('/file', async (req, res) => {
  try {
    const { path: p, content } = req.body
    if (!p) return res.status(400).json({ error: 'path required' })
    const fullPath = safePath(p)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, content ?? '', 'utf8')
    res.json({ ok: true })
  } catch (err) {
    const status = err.message.includes('outside') ? 403 : 500
    res.status(status).json({ error: err.message })
  }
})

// GET /api/watch?path=...
// SSE stream — sends a 'changed' event whenever the file is modified externally.
// The client reconnects automatically via EventSource.
filesRouter.get('/watch', (req, res) => {
  let fullPath
  try {
    fullPath = safePath(req.query.path)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  // Debounce — fs.watch fires twice on Windows (rename + change)
  let debounce = null
  let watcher = null

  try {
    watcher = watch(fullPath, { persistent: false }, (eventType) => {
      if (eventType !== 'change' && eventType !== 'rename') return
      clearTimeout(debounce)
      debounce = setTimeout(() => send('changed', { path: req.query.path }), 80)
    })
  } catch {
    // File may not exist yet — send a 'ready' ping and close
    send('ready', {})
    res.end()
    return
  }

  // Keepalive ping every 15s to prevent proxy/browser timeout
  const ping = setInterval(() => res.write(': ping\n\n'), 15000)

  res.on('close', () => {
    clearInterval(ping)
    clearTimeout(debounce)
    watcher?.close()
  })
})
filesRouter.get('/ls', async (req, res) => {
  try {
    const fullPath = safePath(req.query.path || '')
    const entries = await readdir(fullPath, { withFileTypes: true })
    const items = entries
      .filter(e => !e.name.startsWith('.') || e.name === '.github')
      .map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        ext: e.isFile() ? extname(e.name) : null,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    res.json({ items })
  } catch (err) {
    res.status(404).json({ error: err.message })
  }
})
