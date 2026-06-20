import { Router } from 'express'
import { readFile } from 'fs/promises'
import { SETTINGS_FILE } from '../lib/paths.js'

export const githubRouter = Router()

async function loadSettings() {
  try { return JSON.parse(await readFile(SETTINGS_FILE, 'utf8')) } catch { return {} }
}

function githubHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cap-learning-app',
  }
}

// GET /api/github/runs?owner=X&repo=Y&per_page=10
githubRouter.get('/runs', async (req, res) => {
  const settings = await loadSettings()
  const token = settings.githubToken
  if (!token) return res.status(401).json({ error: 'No GitHub token configured in Settings' })

  const owner = req.query.owner || settings.githubOwner
  const repo = req.query.repo || settings.githubRepo
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' })

  try {
    const perPage = Math.min(parseInt(req.query.per_page || '15', 10), 50)
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`
    const upstream = await fetch(url, { headers: githubHeaders(token) })
    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({ message: upstream.statusText }))
      return res.status(upstream.status).json({ error: err.message })
    }
    const data = await upstream.json()
    // Return normalised run list
    const runs = (data.workflow_runs || []).map(r => ({
      id: r.id,
      name: r.name,
      displayTitle: r.display_title,
      status: r.status,           // queued | in_progress | completed
      conclusion: r.conclusion,   // success | failure | cancelled | skipped | null
      workflowName: r.path?.split('/').pop()?.replace('.yml','') ?? r.name,
      branch: r.head_branch,
      sha: r.head_sha?.slice(0, 7),
      event: r.event,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      runDuration: r.run_started_at && r.updated_at
        ? Math.round((new Date(r.updated_at) - new Date(r.run_started_at)) / 1000)
        : null,
      url: r.html_url,
      actor: r.triggering_actor?.login,
    }))
    res.json({ runs, totalCount: data.total_count })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

// GET /api/github/run/:runId/jobs?owner=X&repo=Y
githubRouter.get('/run/:runId/jobs', async (req, res) => {
  const settings = await loadSettings()
  const token = settings.githubToken
  if (!token) return res.status(401).json({ error: 'No GitHub token configured' })

  const owner = req.query.owner || settings.githubOwner
  const repo = req.query.repo || settings.githubRepo

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${req.params.runId}/jobs`
    const upstream = await fetch(url, { headers: githubHeaders(token) })
    if (!upstream.ok) return res.status(upstream.status).json({ error: upstream.statusText })
    const data = await upstream.json()
    const jobs = (data.jobs || []).map(j => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      startedAt: j.started_at,
      completedAt: j.completed_at,
      steps: (j.steps || []).map(s => ({
        number: s.number,
        name: s.name,
        status: s.status,
        conclusion: s.conclusion,
        duration: s.started_at && s.completed_at
          ? Math.round((new Date(s.completed_at) - new Date(s.started_at)) / 1000)
          : null,
      })),
    }))
    res.json({ jobs })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

// GET /api/github/test?owner=X&repo=Y  — test connection, return repo info
githubRouter.get('/test', async (req, res) => {
  const settings = await loadSettings()
  const token = settings.githubToken
  if (!token) return res.status(401).json({ error: 'No GitHub token configured' })

  const owner = req.query.owner || settings.githubOwner
  const repo = req.query.repo || settings.githubRepo
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' })

  try {
    const [repoRes, runsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: githubHeaders(token) }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`, { headers: githubHeaders(token) }),
    ])
    if (!repoRes.ok) {
      const err = await repoRes.json().catch(() => ({ message: repoRes.statusText }))
      return res.status(repoRes.status).json({ error: err.message })
    }
    const repoData = await repoRes.json()
    const runsData = runsRes.ok ? await runsRes.json() : { total_count: 0 }
    res.json({
      ok: true,
      repo: repoData.full_name,
      private: repoData.private,
      defaultBranch: repoData.default_branch,
      totalRuns: runsData.total_count,
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

// SSE GET /api/github/watch?owner=X&repo=Y — poll every 20s, emit 'update' on new run or status change
githubRouter.get('/watch', async (req, res) => {
  const settings = await loadSettings()
  const token = settings.githubToken
  if (!token) { res.status(401).json({ error: 'No token' }); return }

  const owner = req.query.owner || settings.githubOwner
  const repo = req.query.repo || settings.githubRepo

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event, data) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) } catch { /* ignore */ }
  }

  let lastIds = ''
  let lastStatuses = ''

  async function poll() {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=5`
      const upstream = await fetch(url, { headers: githubHeaders(token) })
      if (!upstream.ok) return
      const data = await upstream.json()
      const runs = data.workflow_runs || []
      const ids = runs.map(r => r.id).join(',')
      const statuses = runs.map(r => `${r.id}:${r.status}:${r.conclusion}`).join(',')
      if (ids !== lastIds || statuses !== lastStatuses) {
        lastIds = ids
        lastStatuses = statuses
        send('update', { timestamp: new Date().toISOString() })
      }
    } catch { /* ignore poll errors */ }
  }

  await poll()
  const interval = setInterval(poll, 20000)
  const ping = setInterval(() => { try { res.write(': ping\n\n') } catch { /* ignore */ } }, 15000)

  res.on('close', () => {
    clearInterval(interval)
    clearInterval(ping)
  })
})
