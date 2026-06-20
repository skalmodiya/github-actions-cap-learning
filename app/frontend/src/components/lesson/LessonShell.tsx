import { useAppState } from '../../context/AppStateContext'
import StepView from './StepView'
import StepNav from './StepNav'
import AIChatPanel from '../ai/AIChatPanel'
import './LessonShell.css'

export default function LessonShell() {
  const { activeModule, activeStep } = useAppState()

  if (!activeModule || !activeStep) {
    return (
      <div className="lesson-empty">
        <div className="lesson-empty-icon">📚</div>
        <p>Select a module tab above to begin.</p>
      </div>
    )
  }

  return (
    <div className="lesson-shell">
      <div className="lesson-main">
        <div className="lesson-content-scroll">
          <StepView />
        </div>
        <StepNav />
      </div>
      <AIChatPanel />
    </div>
  )
}
