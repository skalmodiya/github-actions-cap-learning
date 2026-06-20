import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAppState } from '../../context/AppStateContext'
import { useLLMChat } from '../../hooks/useLLMChat'
import './AIChatPanel.css'

function buildSystemPrompt(
  moduleName: string,
  stepName: string,
  stepIdx: number,
  totalSteps: number,
  contextHints: string[],
  openFilePath: string | null,
  openFileContent: string,
  projectDir: string
): string {
  let prompt = `You are a GitHub Actions + SAP BTP tutor. Be concise and practical.

MODULE: ${moduleName}
STEP ${stepIdx + 1}/${totalSteps}: ${stepName}
CONTEXT TOPICS: ${contextHints.join(', ')}`

  if (projectDir) {
    prompt += `\nPROJECT DIRECTORY: ${projectDir}/`
  }

  if (openFilePath && openFileContent) {
    const cap = openFileContent.slice(-3500)
    prompt += `\n\nCURRENT FILE (${openFilePath}):\n\`\`\`\n${cap}\n\`\`\``
  }

  prompt += `\n\nYou have a write_file tool available. Use it when the user asks you to update, create, or fix a file. Always write the complete file content. When using write_file, use paths relative to the project directory (e.g. "db/schema.cds", not the full path).`

  return prompt
}

export default function AIChatPanel() {
  const { state, dispatch, activeModule, activeStep, activeProjectDir } = useAppState()
  const { messages, streaming, error, send, clear } = useLLMChat()
  const [input, setInput] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isOpen = state.isAIChatOpen

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen])

  const systemPrompt = activeModule && activeStep
    ? buildSystemPrompt(
        activeModule.title, activeStep.title, state.activeStepIndex,
        activeModule.steps.length, activeStep.contextHints,
        state.openFilePath, state.openFileContent, activeProjectDir
      )
    : ''

  const handleSend = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    await send(text, systemPrompt, activeProjectDir || undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <>
      <button
        className="ai-toggle-btn"
        onClick={() => dispatch({ type: 'TOGGLE_AI' })}
        title="AI Tutor"
      >
        <span>🤖</span>
        {!isOpen && <span className="ai-toggle-label">AI Tutor</span>}
      </button>

      {isOpen && (
        <div className="ai-chat-panel">
          <div className="ai-chat-header">
            <div className="ai-chat-title">
              <span>🤖</span>
              <span>AI Tutor</span>
              {activeProjectDir && (
                <span className="ai-project-badge">📁 {activeProjectDir}</span>
              )}
            </div>
            <div className="ai-chat-header-actions">
              {messages.length > 0 && (
                <button onClick={clear} className="ai-chat-clear" title="Clear conversation">Clear</button>
              )}
              <button onClick={() => dispatch({ type: 'TOGGLE_AI' })} className="ai-chat-close" title="Close">✕</button>
            </div>
          </div>

          {activeStep && (
            <div className="ai-context-banner">
              <span className="ai-context-icon">📍</span>
              <span>Context: {activeStep.title}</span>
              {state.openFilePath && (
                <span className="ai-file-badge">{state.openFilePath.split(/[\\/]/).pop()}</span>
              )}
            </div>
          )}

          <div className="ai-messages" ref={messagesRef}>
            {messages.length === 0 && !streaming && (
              <div className="ai-welcome">
                <p>Ask me anything — I can explain concepts or <strong>edit files directly</strong>.</p>
                <div className="ai-suggestions">
                  <button onClick={() => setInput('Explain this concept in simpler terms')}>Explain this concept</button>
                  <button onClick={() => setInput('Show me a real-world example')}>Show example</button>
                  <button onClick={() => setInput('What are common mistakes to avoid?')}>Common mistakes</button>
                  {state.openFilePath && (
                    <button onClick={() => setInput('Review my code and suggest improvements')}>Review my code</button>
                  )}
                  {state.openFilePath && (
                    <button onClick={() => setInput(`Update ${state.openFilePath.split(/[\\/]/).pop()} to add UUID keys and proper types`)}>
                      ✏ Update this file
                    </button>
                  )}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-message ai-message-${msg.role}`}>
                <div className="ai-message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
                <div className="ai-message-content">
                  {/* File written card */}
                  {msg.fileWritten && (
                    <div className="ai-file-written-card">
                      <span className="ai-file-written-icon">✓</span>
                      <div className="ai-file-written-info">
                        <span className="ai-file-written-path">
                          {msg.fileWritten.projectDir
                            ? `${msg.fileWritten.projectDir}/${msg.fileWritten.path}`
                            : msg.fileWritten.path}
                        </span>
                        <span className="ai-file-written-label">updated</span>
                      </div>
                      {msg.fileWritten.explanation && (
                        <p className="ai-file-written-explanation">{msg.fileWritten.explanation}</p>
                      )}
                    </div>
                  )}
                  {/* File write error card */}
                  {msg.fileWriteError && (
                    <div className="ai-file-error-card">
                      <span>⚠ Failed to write {msg.fileWriteError.path}: {msg.fileWriteError.error}</span>
                    </div>
                  )}
                  {/* Message text */}
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown>{msg.content || (streaming && idx === messages.length - 1 ? '▋' : '')}</ReactMarkdown>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {error && (
              <div className="ai-error">
                ⚠ {error}
                <br /><small>Check Settings — LLM proxy must be running</small>
              </div>
            )}
          </div>

          <div className="ai-input-area">
            <textarea
              ref={inputRef}
              className="ai-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask anything or say "update ${state.openFilePath?.split(/[\\/]/).pop() ?? 'the file'} to…" (Enter to send)`}
              rows={2}
              disabled={streaming}
            />
            <button
              className="ai-send-btn primary"
              onClick={handleSend}
              disabled={streaming || !input.trim()}
            >
              {streaming ? '…' : '↑'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
