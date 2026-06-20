import { useState, useCallback, useRef } from 'react'
import type { TerminalLine } from '../types'

interface UseSSEResult {
  lines: TerminalLine[]
  running: boolean
  exitCode: number | null
  elapsed: number | null
  run: (command: string, cwd?: string) => Promise<void>
  stop: () => void
  clear: () => void
}

export function useSSE(): UseSSEResult {
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [running, setRunning] = useState(false)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const clear = useCallback(() => {
    setLines([])
    setExitCode(null)
    setElapsed(null)
  }, [])

  // Strip ANSI escape codes
  const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*[mGKH]/g, '')

  const run = useCallback(async (command: string, cwd?: string) => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setRunning(true)
    setExitCode(null)
    setElapsed(null)
    setLines([{ type: 'info', text: `$ ${command}` }])

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, cwd }),
        signal: abortRef.current.signal,
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.type === 'stdout') {
              const text = stripAnsi(msg.data)
              setLines(prev => [...prev.slice(-4999), { type: 'stdout', text }])
            } else if (msg.type === 'stderr') {
              const text = stripAnsi(msg.data)
              setLines(prev => [...prev.slice(-4999), { type: 'stderr', text }])
            } else if (msg.type === 'done') {
              setExitCode(msg.data.exitCode)
              setElapsed(msg.data.elapsed)
            } else if (msg.type === 'error') {
              setLines(prev => [...prev, { type: 'error', text: msg.data }])
            }
          } catch { /* ignore malformed */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setLines(prev => [...prev, { type: 'error', text: String(err) }])
      }
    } finally {
      setRunning(false)
    }
  }, [])

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
  }, [])

  return { lines, running, exitCode, elapsed, run, stop, clear }
}
