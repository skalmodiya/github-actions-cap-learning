import { useState, useEffect, useRef } from 'react'
import MonacoEditor from '@monaco-editor/react'
import type { StepBlock } from '../../types'
import { useAppState } from '../../context/AppStateContext'
import * as api from '../../lib/api'
import './EditorBlock.css'

interface EditorBlockProps {
  block: Extract<StepBlock, { kind: 'editor' }>
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
  const [externalReload, setExternalReload] = useState(false)

  // Track whether user has unsaved edits — used to decide if external changes should auto-reload
  const userEditedRef = useRef(false)

  const resolvedPath = projectDir ? `${projectDir}/${block.path}` : block.path
  const language = block.language || langFromPath(block.path)

  // ── Initial load ────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    setError(null)
    userEditedRef.current = false
    api.readFile(resolvedPath)
      .then(r => {
        setContent(r.content)
        setSavedContent(r.content)
        setFileExists(true)
        dispatch({ type: 'SET_OPEN_FILE', path: resolvedPath, content: r.content })
      })
      .catch(() => {
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

  // ── File watcher via SSE ────────────────────────────────────
  useEffect(() => {
    if (!fileExists) return // don't watch files that don't exist yet

    const es = new EventSource(`/api/watch?path=${encodeURIComponent(resolvedPath)}`)

    es.addEventListener('changed', () => {
      if (userEditedRef.current) {
        // User has local unsaved edits — flag the conflict, don't overwrite
        setExternalReload(true)
      } else {
        // No local edits — silently reload from disk
        api.readFile(resolvedPath).then(r => {
          setContent(r.content)
          setSavedContent(r.content)
          dispatch({ type: 'SET_OPEN_FILE', path: resolvedPath, content: r.content })
        }).catch(() => {})
      }
    })

    return () => es.close()
  }, [resolvedPath, fileExists])

  // Listen for AI-written files and reload without conflict prompt
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const writtenPath = detail.projectDir
        ? `${detail.projectDir}/${detail.path}`
        : detail.path
      if (writtenPath === resolvedPath || detail.path === resolvedPath) {
        userEditedRef.current = false
        setExternalReload(false)
        api.readFile(resolvedPath).then(r => {
          setContent(r.content)
          setSavedContent(r.content)
          setFileExists(true)
          dispatch({ type: 'SET_OPEN_FILE', path: resolvedPath, content: r.content })
        }).catch(() => {})
      }
    }
    window.addEventListener('ai-file-written', handler)
    return () => window.removeEventListener('ai-file-written', handler)
  }, [resolvedPath])

  const isDirty = !fileExists || content !== savedContent

  // ── Save ────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      await api.writeFile(resolvedPath, content)
      setSavedContent(content)
      setFileExists(true)
      setExternalReload(false)
      userEditedRef.current = false
      setSaveMsg('Saved!')
      dispatch({ type: 'SET_OPEN_FILE', path: resolvedPath, content })
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // Accept external changes and discard local edits
  function handleAcceptExternal() {
    api.readFile(resolvedPath).then(r => {
      setContent(r.content)
      setSavedContent(r.content)
      setExternalReload(false)
      userEditedRef.current = false
      dispatch({ type: 'SET_OPEN_FILE', path: resolvedPath, content: r.content })
    }).catch(() => setExternalReload(false))
  }

  return (
    <div className="editor-block">
      <div className="editor-toolbar">
        <div className="editor-file-info">
          <span className="editor-icon">📄</span>
          <span className="editor-path">{resolvedPath}</span>
          {!fileExists && <span className="editor-new-badge">new</span>}
          {fileExists && isDirty && !externalReload && <span className="editor-dirty">●</span>}
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
            title="Save file"
          >
            {saving ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      </div>

      {/* External change conflict banner */}
      {externalReload && (
        <div className="editor-conflict-bar">
          <span className="editor-conflict-icon">⚠</span>
          <span>File changed externally — your local edits differ from disk.</span>
          <button onClick={handleAcceptExternal} className="editor-conflict-accept">
            ↓ Load from disk
          </button>
          <button onClick={() => setExternalReload(false)} className="editor-conflict-dismiss">
            Keep mine
          </button>
        </div>
      )}

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
              userEditedRef.current = true
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
