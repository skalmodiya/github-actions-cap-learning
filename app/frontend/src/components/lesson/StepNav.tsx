import { useAppState } from '../../context/AppStateContext'
import './StepNav.css'

export default function StepNav() {
  const { state, dispatch, activeModule, activeStep } = useAppState()

  if (!activeModule || !activeStep) return null

  const totalSteps = activeModule.steps.length
  const currentIdx = state.activeStepIndex
  const isFirst = currentIdx === 0
  const isLast = currentIdx === totalSteps - 1
  const isDone = state.progress.completedSteps.includes(activeStep.id)

  const toggleComplete = () => {
    if (isDone) {
      dispatch({ type: 'UNMARK_COMPLETE', stepId: activeStep.id })
    } else {
      dispatch({ type: 'MARK_COMPLETE', stepId: activeStep.id })
      if (!isLast) {
        setTimeout(() => dispatch({ type: 'SET_STEP', index: currentIdx + 1 }), 400)
      }
    }
  }

  return (
    <div className="step-nav">
      <div className="step-nav-info">
        <span className="step-nav-label">
          Step {currentIdx + 1} / {totalSteps}
        </span>
        {activeStep.completionCriteria && (
          <span className="step-nav-criteria">🎯 {activeStep.completionCriteria}</span>
        )}
      </div>

      <div className="step-nav-actions">
        <button
          onClick={() => dispatch({ type: 'SET_STEP', index: currentIdx - 1 })}
          disabled={isFirst}
        >
          ← Previous
        </button>

        <button
          className={`step-complete-btn ${isDone ? 'done' : ''}`}
          onClick={toggleComplete}
        >
          {isDone ? '✓ Completed' : 'Mark Complete ✓'}
        </button>

        <button
          onClick={() => dispatch({ type: 'SET_STEP', index: currentIdx + 1 })}
          disabled={isLast}
          className="primary"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
