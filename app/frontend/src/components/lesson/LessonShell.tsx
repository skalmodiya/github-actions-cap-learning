import { lazy, Suspense, useRef } from 'react'
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
        <p>Select a module from the sidebar to begin.</p>
      </div>
    )
  }

  return (
    <div className="lesson-shell">
      <div className="lesson-main">
        <div className="lesson-header">
          <div className="lesson-breadcrumb">
            <span className="lesson-module-label">{activeModule.icon} {activeModule.title}</span>
            <span className="lesson-breadcrumb-sep">›</span>
            <span className="lesson-step-label">{activeStep.title}</span>
          </div>
        </div>
        <div className="lesson-content-scroll">
          <StepView />
        </div>
        <StepNav />
      </div>
      <AIChatPanel />
    </div>
  )
}
