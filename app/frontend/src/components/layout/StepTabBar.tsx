import { useAppState } from '../../context/AppStateContext'
import './StepTabBar.css'

export default function StepTabBar() {
  const { state, dispatch, activeModule } = useAppState()

  if (!activeModule) return null

  return (
    <div className="step-tab-bar">
      {activeModule.steps.map((step, idx) => {
        const isActive = idx === state.activeStepIndex
        const isDone = state.progress.completedSteps.includes(step.id)

        return (
          <button
            key={step.id}
            className={`step-tab ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
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
  )
}
