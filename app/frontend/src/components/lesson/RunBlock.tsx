import { useState, useEffect } from 'react'
import type { StepBlock } from '../../types'
import { useSSE } from '../../hooks/useSSE'
import './RunBlock.css'

interface RunBlockProps {
  block: Extract<StepBlock, { kind: 'run' }>
  // Set by StepView when block.useProjectDir is true
  projectDir?: string
}

function dispatchTerminalEvent(lines: import('../../types').TerminalLine[], running: boolean, exitCode: number | null, elapsed: number | null) {
  window.dispatchEvent(new CustomEvent('terminal-update', {
    detail: { lines, running, exitCode, elapsed }
  }))
}

export default function RunBlock({ block, projectDir }: RunBlockProps) {
  const { lines, running, exitCode, elapsed, run, clear } = useSSE()
  const [ran, setRan] = useState(false)

  // Resolve cwd: explicit block.cwd wins, then projectDir, then backend default (WORK_DIR)
  const resolvedCwd = block.cwd ?? projectDir ?? undefined

  useEffect(() => {
    if (ran) {
      dispatchTerminalEvent(lines, running, exitCode, elapsed)
    }
  }, [lines, running, exitCode, elapsed, ran])

  const handleRun = async () => {
    setRan(true)
    clear()
    dispatchTerminalEvent([], true, null, null)
    await run(block.command, resolvedCwd)
  }

  const lastLines = lines.slice(-8)
  const hasOutput = lines.length > 1

  return (
    <div className={`run-block ${running ? 'running' : ''} ${ran && exitCode === 0 ? 'success' : ''} ${ran && exitCode !== null && exitCode !== 0 ? 'failed' : ''}`}>
      <div className="run-block-header">
        <div className="run-command-wrap">
          <span className="run-prompt">$</span>
          <code className="run-command">{block.command}</code>
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
          <button
            className="run-btn"
            onClick={handleRun}
            disabled={running || (block.useProjectDir && !projectDir)}
            title={block.useProjectDir && !projectDir ? 'Set a project folder above first' : block.label}
          >
            {running ? (
              <><span className="run-spinner">⟳</span> Running…</>
            ) : (
              <><span>▶</span> {block.label}</>
            )}
          </button>
        </div>
      </div>

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
