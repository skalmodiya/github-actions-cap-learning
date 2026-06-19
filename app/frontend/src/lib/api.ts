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
  type: 'dir' | 'file'
  ext: string | null
}

export async function listDir(path: string): Promise<DirEntry[]> {
  const res = await fetch(`${BASE}/ls?path=${encodeURIComponent(path)}`)
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

// --- LLM ---
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
