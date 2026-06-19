import { lazy, Suspense, useState } from 'react'
import { AppStateProvider } from './context/AppStateContext'
import { SettingsProvider } from './context/SettingsContext'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import LessonShell from './components/lesson/LessonShell'
import TerminalPanel from './components/terminal/TerminalPanel'
import './App.css'

const SettingsPage = lazy(() => import('./components/settings/SettingsPage'))

export default function App() {
  const [showSettings, setShowSettings] = useState(false)

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
                <div className="main-content">
                  <LessonShell />
                  <TerminalPanel />
                </div>
              </>
            )}
          </div>
        </div>
      </AppStateProvider>
    </SettingsProvider>
  )
}
