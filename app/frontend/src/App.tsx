import { lazy, Suspense, useState, useEffect } from 'react'
import { AppStateProvider } from './context/AppStateContext'
import { SettingsProvider } from './context/SettingsContext'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import LessonShell from './components/lesson/LessonShell'
import TerminalPanel from './components/terminal/TerminalPanel'
import './App.css'

const SettingsPage = lazy(() => import('./components/settings/SettingsPage'))

export type TerminalPosition = 'bottom' | 'right'

export interface TerminalLayout {
  position: TerminalPosition
  // bottom: height in px; right: width in px
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

  // Persist whenever layout changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  }, [layout])

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
                <Sidebar />
                <div className={`main-content main-content--${layout.position}`}>
                  <LessonShell />
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
