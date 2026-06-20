import { useState, useEffect, lazy, Suspense } from 'react'
import * as api from '../../lib/api'
import { useAppState } from '../../context/AppStateContext'
import AIChatPanel from '../ai/AIChatPanel'
import './FileEditorOverlay.css'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

interface FileEditorOverlayProps {
  path: string
  onClose: () => void
}

function langFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    yaml: 'yaml', yml: 'yaml', json: 'json', cds: 'plaintext',
    md: 'markdown', sh: 'shell', xml: 'xml', css: 'css', html: 'html',
    csv: 'plaintext',
  }
  return map[ext ?? ''] || 'plaintext'
}

export default function FileEditorOverlay({ path, onClose }: FileEditorOverlayProps) {
  const { dispatch } = useAppState()
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.readFile(path)
      .then(r => {
        setContent(r.content)
        setSavedContent(r.content)
        // Tell AI context which file is open so it can reference it
        dispatch({ type: 'SET_OPEN_FILE', path, content: r.content })
      })
      .catch(() => { setContent(''); setSavedContent('') })
      .finally(() => setLoading(false))

    return () => {
      dispatch({ type: 'SET_OPEN_FILE', path: null, content: '' })
    }
  }, [path])

  // Keep AI context in sync with edits
  useEffect(() => {
    dispatch({ type: 'SET_OPEN_FILE', path, content })
  }, [content, path])

  // Listen for AI file writes — reload silently
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const writtenPath = detail.projectDir
        ? `${detail.projectDir}/${detail.path}`
        : detail.path
      if (writtenPath === path || detail.path === path) {
        api.readFile(path).then(r => {
          setContent(r.content)
          setSavedContent(r.content)
          dispatch({ type: 'SET_OPEN_FILE', path, content: r.content })
        }).catch(() => {})
      }
    }
    window.addEventListener('ai-file-written', handler)
    return () => window.removeEventListener('ai-file-written', handler)
  }, [path])

  const isDirty = content !== savedContent

  async function handleSave() {
    setSaving(true)
    try {
      await api.writeFile(path, content)
      setSavedContent(content)
      setSaveMsg('Saved!')
      // Dispatch file-saved event so file explorer refreshes
      window.dispatchEvent(new CustomEvent('file-saved'))
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="file-editor-overlay">
      {/* Toolbar */}
      <div className="file-editor-overlay-toolbar">
        <div className="file-editor-overlay-info">
          <span className="file-editor-overlay-icon">📄</span>
          <span className="file-editor-overlay-path">{path}</span>
          {isDirty && <span className="file-editor-overlay-dirty">●</span>}
        </div>
        <div className="file-editor-overlay-actions">
          {saveMsg && <span className="file-editor-save-msg">{saveMsg}</span>}
          {error && <span className="file-editor-error">{error}</span>}
          <button
            className="primary"
            onClick={handleSave}
            disabled={saving || !isDirty}
            title="Save file"
          >
            {saving ? 'Saving…' : '💾 Save'}
          </button>
          <button onClick={onClose} title="Close file">✕ Close</button>
        </div>
      </div>

      {/* Editor + AI panel side by side */}
      <div className="file-editor-overlay-main">
        <div className="file-editor-overlay-body">
          {loading ? (
            <div className="file-editor-overlay-loading">Loading…</div>
          ) : (
            <Suspense fallback={<div className="file-editor-overlay-loading">Loading editor…</div>}>
              <MonacoEditor
                height="100%"
                language={langFromPath(path)}
                value={content}
                onChange={val => { setContent(val ?? ''); if (error) setError(null) }}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  fontFamily: 'Cascadia Code, Fira Code, Consolas, monospace',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  tabSize: 2,
                }}
              />
            </Suspense>
          )}
        </div>

        {/* AI Tutor — same panel as in LessonShell */}
        <AIChatPanel />
      </div>
    </div>
  )
}
