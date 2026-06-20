import { useState, useEffect, useRef, useCallback } from 'react'
import type { TerminalLine } from '../../types'
import type { TerminalLayout } from '../../App'
import { useAppState } from '../../context/AppStateContext'
import { useSSE } from '../../hooks/useSSE'
import './TerminalPanel.css'

interface TerminalPanelProps {
  layout: TerminalLayout
  onLayoutChange: (patch: Partial<TerminalLayout>) => void
}

const MIN_SIZE = 120
const MAX_BOTTOM = 700
const MAX_RIGHT = 900

export default function TerminalPanel({ layout, onLayoutChange }: TerminalPanelProps) {
  const { activeProjectDir } = useAppState()
  const { position, size } = layout

  const [allLines, setAllLines] = useState<TerminalLine[]>([])
  const [running, setRunning] = useState(false)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [cwdOverride, setCwdOverride] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ startPos: number; startSize: number } | null>(null)

  const { lines: sseLines, running: sseRunning, exitCode: sseExitCode,
          elapsed: sseElapsed, run, stop, clear: clearSSE } = useSSE()

  useEffect(() => {
    setCwdOverride(activeProjectDir || '')
  }, [activeProjectDir])

  // Receive output from lesson RunBlocks
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail.running) {
        setRunning(true); setExitCode(null); setElapsed(null); setCollapsed(false)
      }
      if (detail.lines?.length > 0) setAllLines(detail.lines)
      if (!detail.running) {
        // Covers both clean exit (exitCode !== null) and abort/kill (exitCode === null)
        setRunning(false)
        setExitCode(detail.exitCode)
        setElapsed(detail.elapsed)
      }
    }
    window.addEventListener('terminal-update', handler)
    return () => window.removeEventListener('terminal-update', handler)
  }, [])

  // Sync SSE output from ad-hoc runs
  useEffect(() => {
    if (sseLines.length > 0) {
      setAllLines(sseLines)
      setRunning(sseRunning)
      if (!sseRunning && sseExitCode !== null) {
        setExitCode(sseExitCode); setElapsed(sseElapsed)
      }
    }
  }, [sseLines, sseRunning, sseExitCode, sseElapsed])

  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [allLines, collapsed])

  // ── Drag-to-resize ──────────────────────────────────────────
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = {
      startPos: position === 'bottom' ? e.clientY : e.clientX,
      startSize: size,
    }

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return
      const delta = position === 'bottom'
        ? dragRef.current.startPos - me.clientY   // drag up → bigger
        : dragRef.current.startPos - me.clientX   // drag left → bigger
      const max = position === 'bottom' ? MAX_BOTTOM : MAX_RIGHT
      const next = Math.max(MIN_SIZE, Math.min(max, dragRef.current.startSize + delta))
      onLayoutChange({ size: Math.round(next) })
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [position, size, onLayoutChange])

  // ── Ad-hoc command ──────────────────────────────────────────
  const handleRun = useCallback(async () => {
    const cmd = input.trim()
    if (!cmd || running || sseRunning) return
    setHistory(h => [cmd, ...h.filter(x => x !== cmd)].slice(0, 50))
    setHistoryIdx(-1)
    setInput('')
    setCollapsed(false)
    clearSSE()
    await run(cmd, cwdOverride || undefined)
  }, [input, running, sseRunning, cwdOverride, run, clearSSE])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleRun() }
    else if (e.key === 'c' && e.ctrlKey && isAnyRunning) {
      e.preventDefault()
      stop()
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
      setAllLines([]); setExitCode(null); setElapsed(null)
    }
  }

  const isAnyRunning = running || sseRunning

  // Inline size style: height when bottom, width when right
  const sizeStyle: React.CSSProperties = collapsed
    ? {}
    : position === 'bottom'
      ? { height: size }
      : { width: size }

  return (
    <div
      className={`terminal-panel terminal-panel--${position} ${collapsed ? 'collapsed' : ''}`}
      style={sizeStyle}
    >
      {/* ── Drag handle ── */}
      {!collapsed && (
        <div
          className={`terminal-resize-handle terminal-resize-handle--${position}`}
          onMouseDown={onDragStart}
          title="Drag to resize"
        />
      )}

      {/* ── Toolbar ── */}
      <div className="terminal-toolbar">
        <div
          className="terminal-title"
          onClick={() => setCollapsed(c => !c)}
          style={{ cursor: 'pointer', flex: 1 }}
        >
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
          {/* Position toggle */}
          <div className="terminal-pos-btns">
            <button
              className={`terminal-pos-btn ${position === 'bottom' ? 'active' : ''}`}
              onClick={() => { onLayoutChange({ position: 'bottom', size: 300 }); setCollapsed(false) }}
              title="Move terminal to bottom"
            >
              ⬇
            </button>
            <button
              className={`terminal-pos-btn ${position === 'right' ? 'active' : ''}`}
              onClick={() => { onLayoutChange({ position: 'right', size: 420 }); setCollapsed(false) }}
              title="Move terminal to right panel"
            >
              ➡
            </button>
          </div>

          {/* Stop button — only when something is running */}
          {isAnyRunning && (
            <button
              className="terminal-stop-btn"
              onClick={stop}
              title="Stop running process (Ctrl+C)"
            >
              ■ Stop
            </button>
          )}

          {/* Size reset */}
          <button
            className="terminal-clear-btn"
            onClick={() => onLayoutChange({ size: position === 'bottom' ? 300 : 420 })}
            title="Reset size"
          >
            ⤢
          </button>

          {allLines.length > 0 && (
            <button
              className="terminal-clear-btn"
              onClick={() => { setAllLines([]); setExitCode(null); setElapsed(null); clearSSE() }}
              title="Clear (Ctrl+L)"
            >
              Clear
            </button>
          )}

          <span
            className="terminal-toggle"
            onClick={() => setCollapsed(c => !c)}
            style={{ cursor: 'pointer' }}
          >
            {collapsed
              ? (position === 'bottom' ? '▲' : '◀')
              : (position === 'bottom' ? '▼' : '▶')
            }
          </span>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* ── Output area ── */}
          <div
            className="terminal-body"
            ref={scrollRef}
            onClick={() => inputRef.current?.focus()}
          >
            {allLines.length === 0 ? (
              <div className="terminal-empty">
                <span className="terminal-empty-icon">⬛</span>
                <span>Type a command below or click <strong>▶ Run</strong> in the lesson</span>
                <span className="terminal-empty-hint">↑↓ history · Ctrl+C stop · Ctrl+L clear</span>
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

          {/* ── Ad-hoc input bar ── */}
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
                placeholder="Enter any command… (↑↓ history, Ctrl+C stop, Ctrl+L clear)"
                disabled={isAnyRunning}
                spellCheck={false}
                autoComplete="off"
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
                  title={`Reset to ${activeProjectDir}/`}
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
