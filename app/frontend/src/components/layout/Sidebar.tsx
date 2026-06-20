import { useState } from 'react'
import { useAppState } from '../../context/AppStateContext'
import FileExplorer from './FileExplorer'
import GHAStatusPanel from '../github/GHAStatusPanel'
import './Sidebar.css'

interface SidebarProps {
  onOpenFile: (path: string) => void
  activeExplorerFile: string | null
  explorerRefresh: number
}

export default function Sidebar({ onOpenFile, activeExplorerFile, explorerRefresh }: SidebarProps) {
  const { state, dispatch, activeModule } = useAppState()
  // Track which module's steps are expanded — can differ from activeModuleId when collapsed
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(state.activeModuleId)

  function handleModuleClick(moduleId: string) {
    dispatch({ type: 'SET_MODULE', moduleId })
    // Toggle: collapse if already expanded, otherwise expand
    setExpandedModuleId(prev => prev === moduleId ? null : moduleId)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-modules">
        {state.modules.map(module => {
          const isActive = module.id === state.activeModuleId
          const isExpanded = module.id === expandedModuleId
          const completedCount = module.steps.filter(s =>
            state.progress.completedSteps.includes(s.id)
          ).length

          return (
            <div key={module.id} className={`sidebar-module ${isActive ? 'active' : ''}`}>
              <button
                className="sidebar-module-header"
                onClick={() => handleModuleClick(module.id)}
              >
                <span className="module-icon">{module.icon}</span>
                <span className="module-title">{module.title}</span>
                <span className="module-progress">
                  {completedCount}/{module.steps.length}
                </span>
                <span className="module-chevron">{isExpanded ? '▾' : '▸'}</span>
              </button>

              {isExpanded && (
                <div className="sidebar-steps">
                  {module.steps.map((step, idx) => {
                    const isActiveStep = isActive && idx === state.activeStepIndex
                    const isDone = state.progress.completedSteps.includes(step.id)

                    return (
                      <button
                        key={step.id}
                        className={`sidebar-step ${isActiveStep ? 'active' : ''} ${isDone ? 'done' : ''}`}
                        onClick={() => {
                          dispatch({ type: 'SET_MODULE', moduleId: module.id })
                          dispatch({ type: 'SET_STEP', index: idx })
                          setExpandedModuleId(module.id)
                        }}
                      >
                        <span className="step-indicator">
                          {isDone ? '✓' : isActiveStep ? '▶' : String(idx + 1)}
                        </span>
                        <span className="step-title">{step.title}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {activeModule && (
        <div className="sidebar-footer">
          <div className="sidebar-progress-bar">
            <div
              className="sidebar-progress-fill"
              style={{
                width: `${
                  activeModule.steps.length > 0
                    ? (activeModule.steps.filter(s =>
                        state.progress.completedSteps.includes(s.id)
                      ).length / activeModule.steps.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <span className="sidebar-progress-label">
            {activeModule.steps.filter(s => state.progress.completedSteps.includes(s.id)).length} of{' '}
            {activeModule.steps.length} steps complete
          </span>
        </div>
      )}

      {/* GitHub Actions live status */}
      <GHAStatusPanel />

      {/* File Explorer — project files tree */}
      <FileExplorer
        onOpenFile={onOpenFile}
        activeFilePath={activeExplorerFile}
        refreshKey={explorerRefresh}
      />
    </aside>
  )
}
