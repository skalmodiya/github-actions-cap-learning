import { useState, useCallback } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  // Set when the AI wrote a file
  fileWritten?: { path: string; explanation: string; projectDir: string | null }
  fileWriteError?: { path: string; error: string }
}

interface UseLLMChatResult {
  messages: ChatMessage[]
  streaming: boolean
  error: string | null
  send: (userMessage: string, systemPrompt?: string, projectDir?: string) => Promise<void>
  clear: () => void
}

export function useLLMChat(): UseLLMChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clear = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const send = useCallback(async (userMessage: string, systemPrompt?: string, projectDir?: string) => {
    setError(null)
    const userMsg: ChatMessage = { role: 'user', content: userMessage }
    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setStreaming(true)

    // Placeholder assistant message — filled in as tokens arrive
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Filter out any messages with empty content — these cause API errors
          messages: updatedHistory
            .map(m => ({ role: m.role, content: m.content }))
            .filter(m => m.content.trim() !== ''),
          systemPrompt,
          projectDir: projectDir || null,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantText = ''
      let fileWrittenData: ChatMessage['fileWritten'] | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const msg = JSON.parse(line.slice(6))

            if (msg.type === 'token') {
              assistantText += msg.data
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: assistantText,
                  fileWritten: fileWrittenData ?? undefined,
                }
                return copy
              })

            } else if (msg.type === 'file_written') {
              // File was written — store metadata on the assistant message
              fileWrittenData = {
                path: msg.data.path,
                explanation: msg.data.explanation,
                projectDir: msg.data.projectDir,
              }
              // Notify any open EditorBlock to reload via a custom event
              window.dispatchEvent(new CustomEvent('ai-file-written', { detail: msg.data }))
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = {
                  ...copy[copy.length - 1],
                  fileWritten: fileWrittenData ?? undefined,
                }
                return copy
              })

            } else if (msg.type === 'file_write_error') {
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = {
                  ...copy[copy.length - 1],
                  fileWriteError: { path: msg.data.path, error: msg.data.error },
                }
                return copy
              })

            } else if (msg.type === 'error') {
              setError(msg.data)
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setStreaming(false)
    }
  }, [messages])

  return { messages, streaming, error, send, clear }
}
