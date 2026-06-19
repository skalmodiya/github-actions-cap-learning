import { useState, useEffect } from 'react'
import type { LLMProvider, AppSettings } from '../../types'
import { useSettings } from '../../context/SettingsContext'
import * as api from '../../lib/api'
import './SettingsPage.css'

const PROVIDERS: { id: LLMProvider; label: string; description: string }[] = [
  { id: 'LiteLLM', label: 'LiteLLM (Recommended)', description: 'Unified access to all models via OpenAI-compatible API' },
  { id: 'Anthropic', label: 'Anthropic', description: 'Claude models via Anthropic Messages API' },
  { id: 'OpenAI', label: 'OpenAI', description: 'GPT models via OpenAI Chat Completions API' },
  { id: 'Gemini', label: 'Google Gemini', description: 'Gemini models via Gemini API' },
]

interface SettingsPageProps {
  onClose: () => void
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const { settings, saveSettings } = useSettings()
  const [form, setForm] = useState<AppSettings>(settings)
  const [models, setModels] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const update = (key: keyof AppSettings, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  async function fetchModels() {
    setFetchingModels(true)
    setModelError(null)
    try {
      await saveSettings({ ...form })
      const list = await api.getModels()
      setModels(list)
      if (list.length > 0 && !list.includes(form.model)) {
        setForm(prev => ({ ...prev, model: list[0] }))
      }
    } catch (err: unknown) {
      setModelError(err instanceof Error ? err.message : String(err))
    } finally {
      setFetchingModels(false)
    }
  }

  async function handleTest() {
    setTestResult(null)
    try {
      await saveSettings({ ...form })
      const list = await api.getModels()
      setTestResult({ ok: true, message: `Connected! ${list.length} model(s) available.` })
      setModels(list)
    } catch (err: unknown) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : String(err) })
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveSettings(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="settings-title">⚙ Settings</h1>
        <button onClick={onClose} className="settings-close">✕ Close</button>
      </div>

      <div className="settings-body">
        {/* LLM Proxy Section */}
        <section className="settings-section">
          <h2 className="settings-section-title">🤖 LLM Proxy Configuration</h2>
          <p className="settings-section-desc">
            Connect to your Hyperspace LLM Proxy running locally.
            Default base URL: <code>http://localhost:6655</code>
          </p>

          <div className="settings-grid">
            <div className="settings-field">
              <label>Provider</label>
              <div className="provider-options">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    className={`provider-option ${form.provider === p.id ? 'selected' : ''}`}
                    onClick={() => update('provider', p.id)}
                  >
                    <span className="provider-name">{p.label}</span>
                    <span className="provider-desc">{p.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="baseUrl">Base URL</label>
              <input
                id="baseUrl"
                type="url"
                value={form.baseUrl}
                onChange={e => update('baseUrl', e.target.value)}
                placeholder="http://localhost:6655"
              />
              <div className="settings-hint">
                Endpoint resolves per provider:
                {form.provider === 'Anthropic' && <> {form.baseUrl}/anthropic/v1/messages</>}
                {form.provider === 'OpenAI' && <> {form.baseUrl}/openai/v1/chat/completions</>}
                {form.provider === 'LiteLLM' && <> {form.baseUrl}/litellm/v1/chat/completions</>}
                {form.provider === 'Gemini' && <> {form.baseUrl}/gemini/v1beta/models/…</>}
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="apiKey">API Key</label>
              <input
                id="apiKey"
                type="password"
                value={form.apiKey}
                onChange={e => update('apiKey', e.target.value)}
                placeholder="Bearer token / API key"
              />
            </div>

            <div className="settings-field">
              <label>Model</label>
              <div className="model-row">
                <select
                  value={form.model}
                  onChange={e => update('model', e.target.value)}
                  style={{ flex: 1 }}
                >
                  {models.length === 0 && (
                    <option value={form.model}>{form.model}</option>
                  )}
                  {models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button onClick={fetchModels} disabled={fetchingModels}>
                  {fetchingModels ? 'Fetching…' : '↻ Fetch Models'}
                </button>
              </div>
              {modelError && <div className="settings-error">{modelError}</div>}
            </div>
          </div>

          <div className="settings-actions">
            <button onClick={handleTest}>🔌 Test Connection</button>
            <button className="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save Settings'}
            </button>
          </div>

          {testResult && (
            <div className={`test-result ${testResult.ok ? 'ok' : 'err'}`}>
              {testResult.ok ? '✓' : '✗'} {testResult.message}
            </div>
          )}
        </section>

        {/* Proxy Reference Section */}
        <section className="settings-section">
          <h2 className="settings-section-title">📋 Hyperspace LLM Proxy Reference</h2>
          <div className="proxy-table-wrap">
            <table className="proxy-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Base Path</th>
                  <th>Chat Endpoint</th>
                  <th>Models Endpoint</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Anthropic</td>
                  <td><code>/anthropic/v1</code></td>
                  <td><code>POST /messages</code></td>
                  <td><code>GET /models</code></td>
                </tr>
                <tr>
                  <td>OpenAI</td>
                  <td><code>/openai/v1</code></td>
                  <td><code>POST /chat/completions</code></td>
                  <td><code>GET /models</code></td>
                </tr>
                <tr>
                  <td>LiteLLM</td>
                  <td><code>/litellm/v1</code></td>
                  <td><code>POST /chat/completions</code></td>
                  <td><code>GET /models</code></td>
                </tr>
                <tr>
                  <td>Gemini</td>
                  <td><code>/gemini</code></td>
                  <td><code>POST /v1beta/models/&#123;model&#125;:generateContent</code></td>
                  <td><code>GET /v1beta/models</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* About Section */}
        <section className="settings-section">
          <h2 className="settings-section-title">ℹ About</h2>
          <p className="settings-section-desc">
            GitHub Actions + SAP BTP Learning App — an interactive learning environment
            for building CI/CD pipelines on SAP Business Technology Platform.
          </p>
          <ul className="settings-about-list">
            <li>Backend API: <code>http://localhost:8877</code></li>
            <li>Frontend: <code>http://localhost:8765</code></li>
            <li>LLM Proxy: <code>{form.baseUrl}</code></li>
            <li>Settings stored: <code>~/.githubActionsCAP-settings.json</code></li>
            <li>Progress stored: <code>~/.githubActionsCAP-progress.json</code></li>
          </ul>
        </section>
      </div>
    </div>
  )
}
