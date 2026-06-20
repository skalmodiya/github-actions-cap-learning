import { lazy, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { useAppState } from '../../context/AppStateContext'
import RunBlock from './RunBlock'
import DirPickerBlock from './DirPickerBlock'
import './StepView.css'
import 'highlight.js/styles/github-dark.css'

const EditorBlock = lazy(() => import('./EditorBlock'))

export default function StepView() {
  const { activeStep, activeProjectDir } = useAppState()

  if (!activeStep) return null

  return (
    <div className="step-view">
      <h2 className="step-title">{activeStep.title}</h2>

      {activeStep.completionCriteria && (
        <div className="step-criteria">
          <span className="step-criteria-icon">🎯</span>
          <span>{activeStep.completionCriteria}</span>
        </div>
      )}

      <div className="step-blocks">
        {activeStep.blocks.map((block, idx) => {
          if (block.kind === 'markdown') {
            return (
              <div key={idx} className="block-markdown">
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {block.content}
                </ReactMarkdown>
              </div>
            )
          }

          if (block.kind === 'code') {
            return (
              <div key={idx} className="block-code">
                {block.filename && (
                  <div className="code-filename">{block.filename}</div>
                )}
                <pre className={`language-${block.language}`}>
                  <code>{block.content}</code>
                </pre>
              </div>
            )
          }

          if (block.kind === 'dirpicker') {
            return <DirPickerBlock key={idx} block={block} />
          }

          if (block.kind === 'run') {
            return (
              <RunBlock
                key={idx}
                block={block}
                projectDir={block.useProjectDir ? activeProjectDir : undefined}
              />
            )
          }

          if (block.kind === 'editor') {
            return (
              <Suspense
                key={idx}
                fallback={<div className="editor-loading">Loading editor…</div>}
              >
                <EditorBlock
                  block={block}
                  projectDir={block.useProjectDir ? activeProjectDir : undefined}
                />
              </Suspense>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
