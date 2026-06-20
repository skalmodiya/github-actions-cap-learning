import { useState, useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import type { StepBlock } from '../../types'
import { useAppState } from '../../context/AppStateContext'
import * as api from '../../lib/api'
import './EditorBlock.css'

interface EditorBlockProps {
  block: Extract<StepBlock, { kind: 'editor' }>
  // Set by StepView when block.useProjectDir is true
  projectDir?: string
}

function langFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    yaml: 'yaml', yml: 'yaml',
    json: 'json',
    cds: 'plaintext',
    md: 'markdown',
    sh: 'shell',
    xml: 'xml',
    css: 'css',
    html: 'html',
  }
  return map[ext ?? ''] || 'plaintext'
}

export default function EditorBlock({ block, projectDir }: EditorBlockProps) {
  const { dispatch } = useAppState()
  const [content, setContent] = useState<string>('')
  const [savedContent, setSavedContent] = useState<string>('')
  const [fileExists, setFileExists] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // If useProjectDir, prepend projectDir/ to the path
  const resolvedPath = projectDir ? `${projectDir}/${block.path}` : block.path
  const language = block.language || langFromPath(block.path)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.readFile(resolvedPath)
      .then(r => {
        setContent(r.content)
        setSavedContent(r.content)
        setFileExists(true)
        dispatch({ type: 'SET_OPEN_FILE', path: resolvedPath, content: r.content })
      })
      .catch(() => {
        // File doesn't exist yet — load default content; treat as unsaved
        const initial = block.defaultContent ?? ''
        setContent(initial)
        setSavedContent(initial)
        setFileExists(false)
        dispatch({ type: 'SET_OPEN_FILE', path: resolvedPath, content: initial })
      })
      .finally(() => setLoading(false))

    return () => {
      dispatch({ type: 'SET_OPEN_FILE', path: null, content: '' })
    }
  }, [resolvedPath, block.defaultContent])

  // Dirty when content differs from disk, OR when file hasn't been saved yet
  const isDirty = !fileExists || content !== savedContent

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      await api.writeFile(resolvedPath, content)
      setSavedContent(content)
      setFileExists(true)
      setSaveMsg('Saved!')
      dispatch({ type: 'SET_OPEN_FILE', path: resolvedPath, content })
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="editor-block">
      <div className="editor-toolbar">
        <div className="editor-file-info">
          <span className="editor-icon">📄</span>
          <span className="editor-path">{resolvedPath}</span>
          {!fileExists && <span className="editor-new-badge">new</span>}
          {fileExists && isDirty && <span className="editor-dirty">●</span>}
        </div>
        {block.description && (
          <span className="editor-desc">{block.description}</span>
        )}
        <div className="editor-actions">
          {saveMsg && <span className="editor-save-msg">{saveMsg}</span>}
          {error && <span className="editor-error">{error}</span>}
          <button
            className="primary"
            onClick={handleSave}
            disabled={saving || !isDirty}
            title="Save file (Ctrl+S equivalent)"
          >
            {saving ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      </div>

      <div className="editor-wrap">
        {loading ? (
          <div className="editor-loading-overlay">Loading…</div>
        ) : (
          <MonacoEditor
            height="340px"
            language={language}
            value={content}
            onChange={val => {
              setContent(val ?? '')
              if (error) setError(null)
            }}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: 'Cascadia Code, Fira Code, Consolas, monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              wordWrap: 'on',
              tabSize: 2,
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
            }}
          />
        )}
      </div>
    </div>
  )
}
