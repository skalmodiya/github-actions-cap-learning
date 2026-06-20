import { useState, useEffect, useRef, useCallback } from 'react'
import type { TerminalLine } from '../../types'
import { useAppState } from '../../context/AppStateContext'
import { useSSE } from '../../hooks/useSSE'
import './TerminalPanel.css'

export default function TerminalPanel() {
  const { activeProjectDir } = useAppState()

  // All output lines — appended from both lesson RunBlocks and ad-hoc input
  const [allLines, setAllLines] = useState<TerminalLine[]>([])
  const [running, setRunning] = useState(false)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  // Ad-hoc input state
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)

  // Custom cwd for ad-hoc commands — defaults to active project dir
  const [cwdOverride, setCwdOverride] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { lines: sseLines, running: sseRunning, exitCode: sseExitCode,
          elapsed: sseElapsed, run, clear: clearSSE } = useSSE()

  // Keep cwd in sync with active project dir (but user can override)
  useEffect(() => {
    setCwdOverride(activeProjectDir || '')
  }, [activeProjectDir])

  // Listen for terminal events from lesson RunBlocks — append, don't replace
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail.running) {
        setRunning(true)
        setExitCode(null)
        setElapsed(null)
        setCollapsed(false)
      }
      if (detail.lines?.length > 0) {
        setAllLines(detail.lines)
      }
      if (!detail.running && detail.exitCode !== null) {
        setRunning(false)
        setExitCode(detail.exitCode)
        setElapsed(detail.elapsed)
      }
    }
    window.addEventListener('terminal-update', handler)
    return () => window.removeEventListener('terminal-update', handler)
  }, [])

  // Append SSE output from ad-hoc runs to allLines
  useEffect(() => {
    if (sseLines.length > 0) {
      setAllLines(sseLines)
      setRunning(sseRunning)
      if (!sseRunning && sseExitCode !== null) {
        setExitCode(sseExitCode)
        setElapsed(sseElapsed)
      }
    }
  }, [sseLines, sseRunning, sseExitCode, sseElapsed])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [allLines, collapsed])

  const handleRun = useCallback(async () => {
    const cmd = input.trim()
    if (!cmd || running || sseRunning) return

    setHistory(h => [cmd, ...h.filter(x => x !== cmd)].slice(0, 50))
    setHistoryIdx(-1)
    setInput('')
    setCollapsed(false)
    clearSSE()

    const cwd = cwdOverride || undefined
    await run(cmd, cwd)
  }, [input, running, sseRunning, cwdOverride, run, clearSSE])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRun()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(historyIdx + 1, history.length - 1)
      setHistoryIdx(idx)
      if (history[idx] !== undefined) setInput(history[idx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Math.max(historyIdx - 1, -1)
      setHistoryIdx(idx)
      setInput(idx === -1 ? '' : (history[idx] ?? ''))
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setAllLines([])
      setExitCode(null)
      setElapsed(null)
    }
  }

  const isAnyRunning = running || sseRunning

  return (
    <div className={`terminal-panel ${collapsed ? 'collapsed' : ''}`}>
      {/* Toolbar — click to collapse/expand */}
      <div className="terminal-toolbar" onClick={() => setCollapsed(c => !c)}>
        <div className="terminal-title">
          <span className="terminal-icon">⬛</span>
          <span>Terminal</span>
          {isAnyRunning && <span className="terminal-running-badge">running</span>}
          {!isAnyRunning && exitCode !== null && (
            <span className={`terminal-exit-badge ${exitCode === 0 ? 'ok' : 'err'}`}>
              exit {exitCode}
            </span>
          )}
          {elapsed !== null && !isAnyRunning && (
            <span className="terminal-elapsed">{(elapsed / 1000).toFixed(1)}s</span>
          )}
        </div>
        <div className="terminal-controls">
          {allLines.length > 0 && (
            <button
              onClick={e => {
                e.stopPropagation()
                setAllLines([])
                setExitCode(null)
                setElapsed(null)
                clearSSE()
              }}
              title="Clear (Ctrl+L)"
              className="terminal-clear-btn"
            >
              Clear
            </button>
          )}
          <span className="terminal-toggle">{collapsed ? '▲' : '▼'}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Output area */}
          <div
            className="terminal-body"
            ref={scrollRef}
            onClick={() => inputRef.current?.focus()}
          >
            {allLines.length === 0 ? (
              <div className="terminal-empty">
                Type a command below or click a <strong>▶ Run</strong> button in the lesson.
              </div>
            ) : (
              allLines.map((line, i) => (
                <div key={i} className={`terminal-line terminal-line-${line.type}`}>
                  {line.text}
                </div>
              ))
            )}
            {isAnyRunning && <span className="terminal-cursor">▋</span>}
          </div>

          {/* Ad-hoc command input bar */}
          <div className="terminal-input-bar">
            <div className="terminal-prompt-area">
              <span className="terminal-prompt-sym">$</span>
              <input
                ref={inputRef}
                className="terminal-input"
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter any command… (↑↓ history, Ctrl+L clear)"
                disabled={isAnyRunning}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
              />
              <button
                className="terminal-run-btn"
                onClick={handleRun}
                disabled={isAnyRunning || !input.trim()}
                title="Run (Enter)"
              >
                {isAnyRunning ? <span className="run-spinner">⟳</span> : '▶'}
              </button>
            </div>
            <div className="terminal-cwd-bar">
              <span className="terminal-cwd-label">cwd:</span>
              <input
                className="terminal-cwd-input"
                type="text"
                value={cwdOverride}
                onChange={e => setCwdOverride(e.target.value)}
                placeholder="(workspace root)"
                spellCheck={false}
              />
              {activeProjectDir && cwdOverride !== activeProjectDir && (
                <button
                  className="terminal-cwd-reset"
                  onClick={() => setCwdOverride(activeProjectDir)}
                  title={`Reset to active project: ${activeProjectDir}/`}
                >
                  ↩ {activeProjectDir}/
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
