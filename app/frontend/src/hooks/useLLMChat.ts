import { useState, useCallback } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UseLLMChatResult {
  messages: ChatMessage[]
  streaming: boolean
  error: string | null
  send: (userMessage: string, systemPrompt?: string) => Promise<void>
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

  const send = useCallback(async (userMessage: string, systemPrompt?: string) => {
    setError(null)
    const userMsg: ChatMessage = { role: 'user', content: userMessage }
    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setStreaming(true)

    // Add empty assistant message that will be filled in
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedHistory.map(m => ({ role: m.role, content: m.content })),
          systemPrompt,
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantText = ''

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
                copy[copy.length - 1] = { role: 'assistant', content: assistantText }
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
      setMessages(prev => prev.slice(0, -1)) // remove empty assistant msg
    } finally {
      setStreaming(false)
    }
  }, [messages])

  return { messages, streaming, error, send, clear }
}
