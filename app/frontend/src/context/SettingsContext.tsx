import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { AppSettings } from '../types'
import * as api from '../lib/api'

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'LiteLLM',
  baseUrl: 'http://localhost:6655',
  apiKey: '',
  model: 'anthropic--claude-4.5-sonnet',
  githubToken: '',
  githubOwner: '',
  githubRepo: 'github-actions-cap-learning',
}

interface SettingsContextValue {
  settings: AppSettings
  setSettings: (s: AppSettings) => void
  saveSettings: (s: AppSettings) => Promise<void>
  loaded: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.getSettings()
      .then(s => { setSettingsState(s); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  async function saveSettings(s: AppSettings) {
    await api.saveSettings(s)
    setSettingsState(s)
  }

  return (
    <SettingsContext.Provider value={{ settings, setSettings: setSettingsState, saveSettings, loaded }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
