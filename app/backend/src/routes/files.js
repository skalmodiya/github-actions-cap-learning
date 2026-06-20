import { Router } from 'express'
import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises'
import { watch } from 'fs'
import { resolve, extname, dirname, join, relative } from 'path'
import { WORK_DIR } from '../lib/paths.js'

export const filesRouter = Router()

function safePath(p) {
  // Empty path → WORK_DIR root
  if (!p || p === '' || p === '.') return resolve(WORK_DIR)
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
    const recursive = req.query.recursive === 'true'
    const maxDepth = Math.min(parseInt(req.query.depth || '4', 10), 6)

    if (!recursive) {
      const entries = await readdir(fullPath, { withFileTypes: true })
      const items = entries
        .filter(e => !e.name.startsWith('.') || e.name === '.github')
        .map(e => ({
          name: e.name,
          path: (req.query.path ? req.query.path + '/' : '') + e.name,
          type: e.isDirectory() ? 'dir' : 'file',
          ext: e.isFile() ? extname(e.name) : null,
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      return res.json({ items })
    }

    // Recursive tree mode
    const SKIP_DIRS = new Set(['node_modules', '.git', 'gen', 'mta_archives', '.vscode', 'dist', 'app', 'test-dir'])

    async function buildTree(dirPath, relBase, depth) {
      if (depth > maxDepth) return []
      let entries
      try { entries = await readdir(dirPath, { withFileTypes: true }) }
      catch { return [] }

      const items = []
      for (const e of entries) {
        if (e.name.startsWith('.') && e.name !== '.github' && e.name !== '.gitignore' && e.name !== '.cdsrc.json') continue
        if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue
        const relPath = relBase ? relBase + '/' + e.name : e.name
        if (e.isDirectory()) {
          const children = await buildTree(join(dirPath, e.name), relPath, depth + 1)
          items.push({ name: e.name, path: relPath, type: 'dir', ext: null, children })
        } else {
          items.push({ name: e.name, path: relPath, type: 'file', ext: extname(e.name), children: [] })
        }
      }
      // dirs first, then alpha
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return items
    }

    const basePath = req.query.path || ''
    const tree = await buildTree(fullPath, basePath, 0)
    res.json({ items: tree })
  } catch (err) {
    res.status(404).json({ error: err.message })
  }
})
