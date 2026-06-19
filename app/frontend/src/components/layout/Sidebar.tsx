import { useAppState } from '../../context/AppStateContext'
import './Sidebar.css'

export default function Sidebar() {
  const { state, dispatch, activeModule } = useAppState()

  return (
    <aside className="sidebar">
      <div className="sidebar-modules">
        {state.modules.map(module => {
          const isActive = module.id === state.activeModuleId
          const completedCount = module.steps.filter(s =>
            state.progress.completedSteps.includes(s.id)
          ).length

          return (
            <div key={module.id} className={`sidebar-module ${isActive ? 'active' : ''}`}>
              <button
                className="sidebar-module-header"
                onClick={() => dispatch({ type: 'SET_MODULE', moduleId: module.id })}
              >
                <span className="module-icon">{module.icon}</span>
                <span className="module-title">{module.title}</span>
                <span className="module-progress">
                  {completedCount}/{module.steps.length}
                </span>
              </button>

              {isActive && (
                <div className="sidebar-steps">
                  {module.steps.map((step, idx) => {
                    const isActiveStep = idx === state.activeStepIndex
                    const isDone = state.progress.completedSteps.includes(step.id)

                    return (
                      <button
                        key={step.id}
                        className={`sidebar-step ${isActiveStep ? 'active' : ''} ${isDone ? 'done' : ''}`}
                        onClick={() => dispatch({ type: 'SET_STEP', index: idx })}
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
    </aside>
  )
}
