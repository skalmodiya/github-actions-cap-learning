import { useState, useEffect, useRef } from 'react'
import type { TerminalLine } from '../../types'
import './TerminalPanel.css'

export default function TerminalPanel() {
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [running, setRunning] = useState(false)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Listen for terminal events from RunBlocks
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setLines(detail.lines)
      setRunning(detail.running)
      setExitCode(detail.exitCode)
      setElapsed(detail.elapsed)
      if (detail.running || detail.lines.length > 0) {
        setCollapsed(false)
      }
    }
    window.addEventListener('terminal-update', handler)
    return () => window.removeEventListener('terminal-update', handler)
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, collapsed])

  return (
    <div className={`terminal-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="terminal-toolbar" onClick={() => setCollapsed(c => !c)}>
        <div className="terminal-title">
          <span className="terminal-icon">⬛</span>
          <span>Terminal</span>
          {running && <span className="terminal-running-badge">running</span>}
          {!running && exitCode !== null && (
            <span className={`terminal-exit-badge ${exitCode === 0 ? 'ok' : 'err'}`}>
              exit {exitCode}
            </span>
          )}
          {elapsed !== null && !running && (
            <span className="terminal-elapsed">{(elapsed / 1000).toFixed(1)}s</span>
          )}
        </div>
        <div className="terminal-controls">
          {lines.length > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLines([]); setExitCode(null); setElapsed(null) }}
              title="Clear terminal"
              className="terminal-clear-btn"
            >
              Clear
            </button>
          )}
          <span className="terminal-toggle">{collapsed ? '▲' : '▼'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="terminal-body" ref={scrollRef}>
          {lines.length === 0 ? (
            <div className="terminal-empty">
              Click a <strong>Run</strong> button in the lesson to execute a command here.
            </div>
          ) : (
            lines.map((line, i) => (
              <div key={i} className={`terminal-line terminal-line-${line.type}`}>
                {line.text}
              </div>
            ))
          )}
          {running && (
            <div className="terminal-cursor">▋</div>
          )}
        </div>
      )}
    </div>
  )
}
