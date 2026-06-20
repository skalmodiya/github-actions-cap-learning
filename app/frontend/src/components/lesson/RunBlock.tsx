import { useState, useEffect } from 'react'
import type { StepBlock } from '../../types'
import { useSSE } from '../../hooks/useSSE'
import './RunBlock.css'

interface RunBlockProps {
  block: Extract<StepBlock, { kind: 'run' }>
  projectDir?: string
}

function dispatchTerminalEvent(lines: import('../../types').TerminalLine[], running: boolean, exitCode: number | null, elapsed: number | null) {
  window.dispatchEvent(new CustomEvent('terminal-update', {
    detail: { lines, running, exitCode, elapsed }
  }))
}

export default function RunBlock({ block, projectDir }: RunBlockProps) {
  const { lines, running, exitCode, elapsed, run, stop, clear } = useSSE()
  const [ran, setRan] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedCommand, setEditedCommand] = useState(block.command)

  // Reset edited command when block changes (step navigation)
  useEffect(() => {
    setEditedCommand(block.command)
    setEditing(false)
  }, [block.command])

  const resolvedCwd = block.cwd ?? projectDir ?? undefined
  const commandToRun = editedCommand.trim() || block.command
  const isModified = editedCommand.trim() !== block.command

  useEffect(() => {
    if (ran) dispatchTerminalEvent(lines, running, exitCode, elapsed)
  }, [lines, running, exitCode, elapsed, ran])

  const handleRun = async () => {
    setRan(true)
    setEditing(false)
    clear()
    dispatchTerminalEvent([], true, null, null)
    await run(commandToRun, resolvedCwd)
  }

  const lastLines = lines.slice(-8)
  const hasOutput = lines.length > 1

  return (
    <div className={`run-block ${running ? 'running' : ''} ${ran && exitCode === 0 ? 'success' : ''} ${ran && exitCode !== null && exitCode !== 0 ? 'failed' : ''}`}>
      <div className="run-block-header">
        <div className="run-command-wrap">
          <span className="run-prompt">$</span>
          {editing ? (
            <span className="run-command run-command--editing">editing…</span>
          ) : (
            <code className={`run-command ${isModified ? 'run-command--modified' : ''}`}>
              {editedCommand}
            </code>
          )}
        </div>
        <div className="run-actions">
          {projectDir && (
            <span className="run-cwd-badge" title={`Running in: ${projectDir}/`}>
              📁 {projectDir}/
            </span>
          )}
          {elapsed !== null && (
            <span className="run-elapsed">{(elapsed / 1000).toFixed(1)}s</span>
          )}
          {exitCode !== null && (
            <span className={`run-exit ${exitCode === 0 ? 'ok' : 'err'}`}>
              exit {exitCode}
            </span>
          )}
          {/* Edit toggle — only when not running */}
          {!running && (
            <button
              className={`run-edit-btn ${editing ? 'active' : ''}`}
              onClick={() => setEditing(e => !e)}
              title={editing ? 'Close editor' : 'Edit command before running'}
            >
              ✏
            </button>
          )}
          <button
            className="run-btn"
            onClick={handleRun}
            disabled={running || (block.useProjectDir && !projectDir)}
            title={block.useProjectDir && !projectDir ? 'Set a project folder above first' : block.label}
          >
            {running
              ? <><span className="run-spinner">⟳</span> Running…</>
              : <><span>▶</span> {block.label}</>
            }
          </button>
          {running && (
            <button className="run-stop-btn" onClick={stop} title="Stop process (Ctrl+C)">
              ■ Stop
            </button>
          )}
        </div>
      </div>

      {/* Inline command editor */}
      {editing && !running && (
        <div className="run-editor">
          <div className="run-editor-label">
            <span>✏ Edit command</span>
            {isModified && (
              <button
                className="run-editor-reset"
                onClick={() => setEditedCommand(block.command)}
                title="Reset to original"
              >
                ↩ Reset
              </button>
            )}
          </div>
          <textarea
            className="run-editor-textarea"
            value={editedCommand}
            onChange={e => setEditedCommand(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleRun()
              }
            }}
            rows={Math.max(2, editedCommand.split('\n').length)}
            spellCheck={false}
            autoFocus
          />
          <div className="run-editor-hint">
            Change any values above (URLs, flags, names) then click ▶ to run. Ctrl+Enter to run immediately.
          </div>
        </div>
      )}

      {block.useProjectDir && !projectDir && (
        <div className="run-needs-dir">
          ⬆ Set a project folder above before running this command
        </div>
      )}

      {hasOutput && (
        <div className="run-output">
          {lastLines.map((line, i) => (
            <div key={i} className={`run-line run-line-${line.type}`}>
              {line.text.trimEnd()}
            </div>
          ))}
          {lines.length > 8 && (
            <div className="run-line run-line-info">
              … {lines.length - 8} more lines — see terminal below
            </div>
          )}
        </div>
      )}
    </div>
  )
}
