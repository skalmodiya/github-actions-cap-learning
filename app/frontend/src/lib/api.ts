import type { AppSettings, ProgressState } from '../types'

const BASE = '/api'

// --- Execute ---
export function executeCommand(command: string, cwd?: string): Promise<Response> {
  return fetch(`${BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, cwd }),
  })
}

// --- Files ---
export async function readFile(path: string): Promise<{ content: string; path: string }> {
  const res = await fetch(`${BASE}/file?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error(`Cannot read ${path}: ${res.status}`)
  return res.json()
}

export async function writeFile(path: string, content: string): Promise<void> {
  const res = await fetch(`${BASE}/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `Write failed: ${res.status}`)
  }
}

export interface DirEntry {
  name: string
  path: string
  type: 'dir' | 'file'
  ext: string | null
  children?: DirEntry[]
}

export async function listDir(path: string): Promise<DirEntry[]> {
  const res = await fetch(`${BASE}/ls?path=${encodeURIComponent(path)}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.items || []
}

export async function listDirTree(path: string, depth = 4): Promise<DirEntry[]> {
  const res = await fetch(`${BASE}/ls?path=${encodeURIComponent(path)}&recursive=true&depth=${depth}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.items || []
}

// --- Settings ---
export async function getSettings(): Promise<AppSettings> {
  const res = await fetch(`${BASE}/settings`)
  if (!res.ok) throw new Error('Failed to load settings')
  return res.json()
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const res = await fetch(`${BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error('Failed to save settings')
}

// --- Progress ---
export async function getProgress(): Promise<ProgressState> {
  const res = await fetch(`${BASE}/progress`)
  if (!res.ok) throw new Error('Failed to load progress')
  return res.json()
}

export async function saveProgress(progress: ProgressState): Promise<void> {
  await fetch(`${BASE}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progress),
  })
}

// --- GitHub Actions ---
export interface GHARun {
  id: number
  name: string
  displayTitle: string
  status: string
  conclusion: string | null
  workflowName: string
  branch: string
  sha: string
  event: string
  createdAt: string
  updatedAt: string
  runDuration: number | null
  url: string
  actor: string
}

export interface GHAJob {
  id: number
  name: string
  status: string
  conclusion: string | null
  startedAt: string | null
  completedAt: string | null
  steps: { number: number; name: string; status: string; conclusion: string | null; duration: number | null }[]
}

export async function getGHARuns(owner: string, repo: string): Promise<{ runs: GHARun[]; totalCount: number }> {
  const res = await fetch(`${BASE}/github/runs?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`) }
  return res.json()
}

export async function getGHAJobs(runId: number, owner: string, repo: string): Promise<{ jobs: GHAJob[] }> {
  const res = await fetch(`${BASE}/github/run/${runId}/jobs?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`) }
  return res.json()
}

export async function testGitHubConnection(owner: string, repo: string): Promise<{ ok: boolean; repo: string; totalRuns: number }> {
  const res = await fetch(`${BASE}/github/test?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`) }
  return res.json()
}
export async function getModels(): Promise<string[]> {
  const res = await fetch(`${BASE}/llm/models`)
  if (!res.ok) throw new Error('Failed to fetch models')
  const data = await res.json()
  return data.models || []
}

export function chatStream(
  messages: { role: string; content: string }[],
  systemPrompt?: string
): Promise<Response> {
  return fetch(`${BASE}/llm/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt }),
  })
}
