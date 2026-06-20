import { useState, useEffect, lazy, Suspense } from 'react'
import * as api from '../../lib/api'
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
  }
  return map[ext ?? ''] || 'plaintext'
}

export default function FileEditorOverlay({ path, onClose }: FileEditorOverlayProps) {
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.readFile(path)
      .then(r => { setContent(r.content); setSavedContent(r.content) })
      .catch(() => { setContent(''); setSavedContent('') })
      .finally(() => setLoading(false))
  }, [path])

  const isDirty = content !== savedContent
  const filename = path.split(/[\\/]/).pop() ?? path

  async function handleSave() {
    setSaving(true)
    try {
      await api.writeFile(path, content)
      setSavedContent(content)
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="file-editor-overlay">
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
          >
            {saving ? 'Saving…' : '💾 Save'}
          </button>
          <button onClick={onClose} title="Close">✕</button>
        </div>
      </div>

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
    </div>
  )
}
