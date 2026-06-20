import { useState } from 'react'
import type { StepBlock } from '../../types'
import { useAppState } from '../../context/AppStateContext'
import * as api from '../../lib/api'
import './DirPickerBlock.css'

interface DirPickerBlockProps {
  block: Extract<StepBlock, { kind: 'dirpicker' }>
}

export default function DirPickerBlock({ block }: DirPickerBlockProps) {
  const { state, dispatch, activeProjectDir } = useAppState()
  const [input, setInput] = useState(activeProjectDir || 'my-cap-app')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSet = !!activeProjectDir

  async function handleCreate() {
    const name = input.trim().replace(/[^a-zA-Z0-9_\-]/g, '-')
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      // Create the directory via backend file API
      await api.writeFile(`${name}/.gitkeep`, '')
      dispatch({ type: 'SET_PROJECT_DIR', moduleId: state.activeModuleId, dir: name })
      setCreated(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  function handleChange() {
    const name = input.trim().replace(/[^a-zA-Z0-9_\-]/g, '-')
    if (!name) return
    dispatch({ type: 'SET_PROJECT_DIR', moduleId: state.activeModuleId, dir: name })
    setCreated(false)
  }

  return (
    <div className={`dirpicker-block ${isSet ? 'dirpicker-set' : ''}`}>
      <div className="dirpicker-header">
        <span className="dirpicker-icon">📁</span>
        <span className="dirpicker-label">
          {block.label || 'Choose your project folder name'}
        </span>
      </div>

      {block.description && (
        <p className="dirpicker-desc">{block.description}</p>
      )}

      <div className="dirpicker-row">
        <span className="dirpicker-prefix">~/githubActionsCAP /</span>
        <input
          className="dirpicker-input"
          type="text"
          value={input}
          onChange={e => {
            setInput(e.target.value)
            setCreated(false)
          }}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="my-cap-app"
          spellCheck={false}
        />
        <button
          className="dirpicker-create-btn primary"
          onClick={handleCreate}
          disabled={creating || !input.trim()}
        >
          {creating ? 'Creating…' : created ? '✓ Created' : '📂 Create Folder'}
        </button>
        {isSet && activeProjectDir !== input.trim() && (
          <button className="dirpicker-change-btn" onClick={handleChange}>
            Use this name
          </button>
        )}
      </div>

      {error && <div className="dirpicker-error">⚠ {error}</div>}

      {isSet && (
        <div className="dirpicker-status">
          <span className="dirpicker-status-dot" />
          All commands and file edits below will run inside{' '}
          <code>{activeProjectDir}/</code>
        </div>
      )}
    </div>
  )
}
