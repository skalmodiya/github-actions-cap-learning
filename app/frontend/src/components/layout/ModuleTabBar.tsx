import { useRef, useEffect } from 'react'
import { useAppState } from '../../context/AppStateContext'
import './ModuleTabBar.css'

export default function ModuleTabBar() {
  const { state, dispatch, activeModule, activeStep } = useAppState()
  const stepTabsRef = useRef<HTMLDivElement>(null)
  const activeStepRef = useRef<HTMLButtonElement>(null)

  // Scroll active step tab into view whenever it changes
  useEffect(() => {
    if (activeStepRef.current && stepTabsRef.current) {
      activeStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [state.activeModuleId, state.activeStepIndex])

  return (
    <div className="module-tab-bar">
      {/* Module tabs — top row */}
      <div className="module-tabs">
        {state.modules.map(module => {
          const isActive = module.id === state.activeModuleId
          const completedCount = module.steps.filter(s =>
            state.progress.completedSteps.includes(s.id)
          ).length
          const allDone = completedCount === module.steps.length

          return (
            <button
              key={module.id}
              className={`module-tab ${isActive ? 'active' : ''} ${allDone ? 'done' : ''}`}
              onClick={() => dispatch({ type: 'SET_MODULE', moduleId: module.id })}
              title={module.description}
            >
              <span className="module-tab-icon">{module.icon}</span>
              <span className="module-tab-title">{module.title}</span>
              <span className="module-tab-progress">
                {allDone ? '✓' : `${completedCount}/${module.steps.length}`}
              </span>
            </button>
          )
        })}
      </div>

      {/* Step tabs — bottom row, scrollable */}
      {activeModule && (
        <div className="step-tabs" ref={stepTabsRef}>
          {activeModule.steps.map((step, idx) => {
            const isActiveStep = idx === state.activeStepIndex
            const isDone = state.progress.completedSteps.includes(step.id)

            return (
              <button
                key={step.id}
                ref={isActiveStep ? activeStepRef : null}
                className={`step-tab ${isActiveStep ? 'active' : ''} ${isDone ? 'done' : ''}`}
                onClick={() => dispatch({ type: 'SET_STEP', index: idx })}
                title={step.title}
              >
                <span className="step-tab-num">
                  {isDone ? '✓' : idx + 1}
                </span>
                <span className="step-tab-title">{step.title}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
