import { Router } from 'express'
import { readFile } from 'fs/promises'
import { SETTINGS_FILE } from '../lib/paths.js'

export const llmRouter = Router()

const DEFAULT_SETTINGS = {
  provider: 'LiteLLM',
  baseUrl: 'http://localhost:6655',
  apiKey: '',
  model: 'anthropic--claude-4.5-sonnet',
}

async function loadSettings() {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return DEFAULT_SETTINGS
  }
}

// GET /api/llm/models — return model list from configured provider
llmRouter.get('/models', async (req, res) => {
  const settings = await loadSettings()
  const { provider, baseUrl, apiKey } = settings
  const headers = { 'Authorization': `Bearer ${apiKey || 'no-key'}`, 'Content-Type': 'application/json' }

  try {
    let url
    if (provider === 'Gemini') {
      url = `${baseUrl}/gemini/v1beta/models`
    } else if (provider === 'Anthropic') {
      url = `${baseUrl}/anthropic/v1/models`
    } else if (provider === 'OpenAI') {
      url = `${baseUrl}/openai/v1/models`
    } else {
      url = `${baseUrl}/litellm/v1/models`
    }

    const upstream = await fetch(url, { headers })
    const data = await upstream.json()

    // Normalise to string[] of model IDs
    let models = []
    if (provider === 'Gemini') {
      models = (data.models || []).map(m => m.name?.replace('models/', '') || m.name)
    } else if (provider === 'Anthropic') {
      models = (data.data || data.models || []).map(m => m.id || m.name)
    } else {
      models = (data.data || []).map(m => m.id || m.name)
    }

    res.json({ models: models.filter(Boolean) })
  } catch (err) {
    res.status(502).json({ error: `Cannot reach LLM proxy: ${err.message}` })
  }
})

// POST /api/llm/chat — proxy streaming chat to configured provider
llmRouter.post('/chat', async (req, res) => {
  const settings = await loadSettings()
  const { provider, baseUrl, apiKey, model } = settings
  const { messages, systemPrompt } = req.body

  const authHeader = { 'Authorization': `Bearer ${apiKey || 'no-key'}` }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`)

  try {
    let upstreamRes

    if (provider === 'Anthropic') {
      // Anthropic messages API
      const body = {
        model,
        max_tokens: 2048,
        stream: true,
        system: systemPrompt || 'You are a GitHub Actions + SAP BTP tutor.',
        messages,
      }
      upstreamRes = await fetch(`${baseUrl}/anthropic/v1/messages`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      })
    } else if (provider === 'Gemini') {
      // Gemini generateContent — convert messages format
      const geminiMessages = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
      const body = {
        contents: geminiMessages,
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: { maxOutputTokens: 2048 },
      }
      upstreamRes = await fetch(`${baseUrl}/gemini/v1beta/models/${model}:streamGenerateContent`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      // OpenAI / LiteLLM compatible
      const endpoint = provider === 'OpenAI'
        ? `${baseUrl}/openai/v1/chat/completions`
        : `${baseUrl}/litellm/v1/chat/completions`
      const allMessages = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages
      const body = { model, messages: allMessages, stream: true, max_tokens: 2048 }
      upstreamRes = await fetch(endpoint, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    if (!upstreamRes.ok) {
      const err = await upstreamRes.text()
      send('error', `LLM error ${upstreamRes.status}: ${err}`)
      res.end()
      return
    }

    // Stream SSE from upstream to client
    const reader = upstreamRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue

        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6))
            let text = ''

            if (provider === 'Anthropic') {
              // Anthropic streaming delta
              if (json.type === 'content_block_delta') {
                text = json.delta?.text || ''
              }
            } else if (provider === 'Gemini') {
              // Gemini streaming
              text = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
            } else {
              // OpenAI/LiteLLM
              text = json.choices?.[0]?.delta?.content || ''
            }

            if (text) send('token', text)
          } catch { /* skip malformed SSE lines */ }
        }
      }
    }

    send('done', {})
    res.end()
  } catch (err) {
    send('error', err.message)
    res.end()
  }
})
