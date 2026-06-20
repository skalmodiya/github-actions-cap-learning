import { useState, useEffect, useCallback } from 'react'
import type { GHARun, GHAJob } from '../../lib/api'
import * as api from '../../lib/api'
import { useSettings } from '../../context/SettingsContext'
import './GHAStatusPanel.css'

function statusIcon(status: string, conclusion: string | null): string {
  if (status === 'in_progress' || status === 'queued') return '⟳'
  if (conclusion === 'success') return '✓'
  if (conclusion === 'failure') return '✗'
  if (conclusion === 'cancelled') return '⊘'
  if (conclusion === 'skipped') return '−'
  return '?'
}

function statusClass(status: string, conclusion: string | null): string {
  if (status === 'in_progress') return 'gha-running'
  if (status === 'queued') return 'gha-queued'
  if (conclusion === 'success') return 'gha-success'
  if (conclusion === 'failure') return 'gha-failure'
  if (conclusion === 'cancelled') return 'gha-cancelled'
  return 'gha-neutral'
}

function formatDuration(s: number | null): string {
  if (!s) return ''
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function formatRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function GHAStatusPanel() {
  const { settings } = useSettings()
  const [runs, setRuns] = useState<GHARun[]>([])
  const [expandedRun, setExpandedRun] = useState<number | null>(null)
  const [jobs, setJobs] = useState<Record<number, GHAJob[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const owner = settings.githubOwner
  const repo = settings.githubRepo
  const hasConfig = !!(owner && repo && settings.githubToken)

  const load = useCallback(async () => {
    if (!hasConfig) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.getGHARuns(owner, repo)
      setRuns(data.runs)
      setLastUpdated(new Date())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [hasConfig, owner, repo])

  // Initial load + SSE watch for updates
  useEffect(() => {
    if (!hasConfig) return
    load()

    const es = new EventSource(`/api/github/watch?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
    es.addEventListener('update', () => load())
    return () => es.close()
  }, [hasConfig, load, owner, repo])

  async function toggleRun(runId: number) {
    if (expandedRun === runId) { setExpandedRun(null); return }
    setExpandedRun(runId)
    if (!jobs[runId]) {
      try {
        const data = await api.getGHAJobs(runId, owner, repo)
        setJobs(prev => ({ ...prev, [runId]: data.jobs }))
      } catch { /* ignore */ }
    }
  }

  if (!hasConfig) {
    return (
      <div className="gha-panel gha-panel--unconfigured">
        <div className="gha-header" onClick={() => setCollapsed(c => !c)}>
          <span className="gha-header-icon">⚡</span>
          <span className="gha-header-title">GitHub Actions</span>
          <span className="gha-collapse-arrow">{collapsed ? '▲' : '▼'}</span>
        </div>
        {!collapsed && (
          <div className="gha-empty">
            Configure GitHub repo in <strong>⚙ Settings</strong> to see live run status.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`gha-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="gha-header" onClick={() => setCollapsed(c => !c)}>
        <span className="gha-header-icon">⚡</span>
        <span className="gha-header-title">
          {owner}/{repo}
        </span>
        <div className="gha-header-actions" onClick={e => e.stopPropagation()}>
          {lastUpdated && <span className="gha-updated">{formatRelative(lastUpdated.toISOString())}</span>}
          <button className="gha-refresh-btn" onClick={load} disabled={loading} title="Refresh">
            {loading ? <span className="gha-spinner">⟳</span> : '↺'}
          </button>
          <span className="gha-collapse-arrow">{collapsed ? '▲' : '▼'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="gha-runs">
          {error && <div className="gha-error">⚠ {error}</div>}
          {!error && runs.length === 0 && !loading && (
            <div className="gha-empty">No workflow runs found.</div>
          )}
          {runs.map(run => (
            <div key={run.id} className="gha-run">
              <button
                className={`gha-run-row ${statusClass(run.status, run.conclusion)}`}
                onClick={() => toggleRun(run.id)}
              >
                <span className={`gha-status-icon ${statusClass(run.status, run.conclusion)}`}>
                  {run.status === 'in_progress' ? <span className="gha-spinner">⟳</span> : statusIcon(run.status, run.conclusion)}
                </span>
                <div className="gha-run-info">
                  <span className="gha-run-title">{run.displayTitle || run.name}</span>
                  <span className="gha-run-meta">
                    {run.workflowName} · {run.branch} · {run.sha}
                    {run.runDuration !== null && ` · ${formatDuration(run.runDuration)}`}
                  </span>
                </div>
                <span className="gha-run-time">{formatRelative(run.createdAt)}</span>
                <span className="gha-expand-arrow">{expandedRun === run.id ? '▾' : '▸'}</span>
              </button>

              {expandedRun === run.id && (
                <div className="gha-jobs">
                  {!jobs[run.id] ? (
                    <div className="gha-jobs-loading">Loading jobs…</div>
                  ) : jobs[run.id].map(job => (
                    <div key={job.id} className="gha-job">
                      <div className={`gha-job-header ${statusClass(job.status, job.conclusion)}`}>
                        <span className="gha-status-icon">{statusIcon(job.status, job.conclusion)}</span>
                        <span className="gha-job-name">{job.name}</span>
                      </div>
                      <div className="gha-steps">
                        {job.steps.map(step => (
                          <div key={step.number} className={`gha-step ${statusClass(step.status, step.conclusion)}`}>
                            <span className="gha-step-icon">{statusIcon(step.status, step.conclusion)}</span>
                            <span className="gha-step-name">{step.name}</span>
                            {step.duration !== null && <span className="gha-step-dur">{formatDuration(step.duration)}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <a
                    href={run.url}
                    target="_blank"
                    rel="noreferrer"
                    className="gha-open-link"
                    onClick={e => e.stopPropagation()}
                  >
                    Open in GitHub ↗
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
