import { lazy, Suspense, useState, useEffect } from 'react'
import { AppStateProvider } from './context/AppStateContext'
import { SettingsProvider } from './context/SettingsContext'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import ModuleTabBar from './components/layout/ModuleTabBar'
import StepTabBar from './components/layout/StepTabBar'
import LessonShell from './components/lesson/LessonShell'
import TerminalPanel from './components/terminal/TerminalPanel'
import FileEditorOverlay from './components/layout/FileEditorOverlay'
import './App.css'

const SettingsPage = lazy(() => import('./components/settings/SettingsPage'))

export type TerminalPosition = 'bottom' | 'right'

export interface TerminalLayout {
  position: TerminalPosition
  size: number
}

const STORAGE_KEY = 'cap-terminal-layout'
const DEFAULTS: TerminalLayout = { position: 'bottom', size: 300 }

function loadLayout(): TerminalLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULTS
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [layout, setLayout] = useState<TerminalLayout>(loadLayout)
  // File opened from the file explorer (outside lesson steps)
  const [explorerFile, setExplorerFile] = useState<string | null>(null)
  // Refresh key for file explorer (increment when files change)
  const [explorerRefresh, setExplorerRefresh] = useState(0)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  }, [layout])

  // Listen for ai-file-written events to refresh the explorer tree
  useEffect(() => {
    const handler = () => setExplorerRefresh(k => k + 1)
    window.addEventListener('ai-file-written', handler)
    // Also refresh when any file is saved via editor
    window.addEventListener('file-saved', handler)
    return () => {
      window.removeEventListener('ai-file-written', handler)
      window.removeEventListener('file-saved', handler)
    }
  }, [])

  const updateLayout = (patch: Partial<TerminalLayout>) =>
    setLayout(prev => ({ ...prev, ...patch }))

  return (
    <SettingsProvider>
      <AppStateProvider>
        <div className="app-root">
          <Header
            onSettingsClick={() => setShowSettings(s => !s)}
            showingSettings={showSettings}
          />
          <div className="app-body">
            {showSettings ? (
              <Suspense fallback={<div className="app-loading">Loading settings…</div>}>
                <SettingsPage onClose={() => setShowSettings(false)} />
              </Suspense>
            ) : (
              <>
                <Sidebar
                  onOpenFile={setExplorerFile}
                  activeExplorerFile={explorerFile}
                  explorerRefresh={explorerRefresh}
                />
                <div className={`main-content main-content--${layout.position}`}>
                  <StepTabBar />
                  {explorerFile ? (
                    <FileEditorOverlay
                      path={explorerFile}
                      onClose={() => setExplorerFile(null)}
                    />
                  ) : (
                    <LessonShell />
                  )}
                  <TerminalPanel layout={layout} onLayoutChange={updateLayout} />
                </div>
              </>
            )}
          </div>
        </div>
      </AppStateProvider>
    </SettingsProvider>
  )
}
