import { Router } from 'express'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { SETTINGS_FILE, WORK_DIR } from '../lib/paths.js'

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

// ── Tool definition ──────────────────────────────────────────────────────────
// Sent to the LLM so it knows it can write files
const WRITE_FILE_TOOL = {
  type: 'function',
  function: {
    name: 'write_file',
    description: 'Write or overwrite a file in the project workspace. Use this when the user asks you to update, create, or fix a file.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative file path inside the project directory (e.g. "db/schema.cds", "srv/catalog-service.cds", ".github/workflows/deploy.yml")',
        },
        content: {
          type: 'string',
          description: 'Full file content to write. Always provide the complete file, not a diff.',
        },
        explanation: {
          type: 'string',
          description: 'Brief explanation of what was changed and why.',
        },
      },
      required: ['path', 'content', 'explanation'],
    },
  },
}

// Anthropic tool format
const WRITE_FILE_TOOL_ANTHROPIC = {
  name: 'write_file',
  description: WRITE_FILE_TOOL.function.description,
  input_schema: WRITE_FILE_TOOL.function.parameters,
}

// Safe write — path must stay inside projectDir or WORK_DIR
async function safeWriteFile(filePath, content, projectDir) {
  const base = projectDir ? resolve(WORK_DIR, projectDir) : WORK_DIR
  const full = resolve(base, filePath.replace(/\//g, '\\'))
  if (!full.startsWith(resolve(WORK_DIR))) {
    throw new Error('Path outside workspace')
  }
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, content, 'utf8')
  return full
}

// ── Models endpoint ──────────────────────────────────────────────────────────
llmRouter.get('/models', async (req, res) => {
  const settings = await loadSettings()
  const { provider, baseUrl, apiKey } = settings
  const headers = { 'Authorization': `Bearer ${apiKey || 'no-key'}`, 'Content-Type': 'application/json' }

  try {
    let url
    if (provider === 'Gemini') url = `${baseUrl}/gemini/v1beta/models`
    else if (provider === 'Anthropic') url = `${baseUrl}/anthropic/v1/models`
    else if (provider === 'OpenAI') url = `${baseUrl}/openai/v1/models`
    else url = `${baseUrl}/litellm/v1/models`

    const upstream = await fetch(url, { headers })
    const data = await upstream.json()

    let models = []
    if (provider === 'Gemini') models = (data.models || []).map(m => m.name?.replace('models/', '') || m.name)
    else if (provider === 'Anthropic') models = (data.data || data.models || []).map(m => m.id || m.name)
    else models = (data.data || []).map(m => m.id || m.name)

    res.json({ models: models.filter(Boolean) })
  } catch (err) {
    res.status(502).json({ error: `Cannot reach LLM proxy: ${err.message}` })
  }
})

// ── Chat endpoint ────────────────────────────────────────────────────────────
llmRouter.post('/chat', async (req, res) => {
  const settings = await loadSettings()
  const { provider, baseUrl, apiKey, model } = settings
  const { messages: rawMessages, systemPrompt, projectDir } = req.body

  // Sanitize: remove any messages with empty/whitespace-only content
  // These cause API errors (e.g. Anthropic: "all messages must have non-empty content")
  const messages = (rawMessages || []).filter(m => m.content && m.content.trim() !== '')

  const authHeader = { 'Authorization': `Bearer ${apiKey || 'no-key'}` }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (type, data) => {
    try { res.write(`data: ${JSON.stringify({ type, data })}\n\n`) } catch { /* ignore */ }
  }

  try {
    // ── Phase 1: non-streaming request WITH tool ──────────────────────────
    // We need to see if the model wants to call write_file before streaming
    let phase1Res, phase1Body

    if (provider === 'Anthropic') {
      phase1Body = {
        model, max_tokens: 4096, stream: false,
        system: systemPrompt || 'You are a GitHub Actions + SAP BTP tutor.',
        messages,
        tools: [WRITE_FILE_TOOL_ANTHROPIC],
      }
      phase1Res = await fetch(`${baseUrl}/anthropic/v1/messages`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(phase1Body),
      })
    } else if (provider === 'Gemini') {
      // Gemini doesn't support function calling via our proxy the same way — fall through to text-only
      phase1Res = null
    } else {
      // OpenAI / LiteLLM
      const endpoint = provider === 'OpenAI'
        ? `${baseUrl}/openai/v1/chat/completions`
        : `${baseUrl}/litellm/v1/chat/completions`
      const allMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages
      phase1Body = { model, messages: allMessages, stream: false, max_tokens: 4096, tools: [WRITE_FILE_TOOL] }
      phase1Res = await fetch(endpoint, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(phase1Body),
      })
    }

    // ── Check for tool call in Phase 1 response ───────────────────────────
    let toolCall = null
    let phase1Data = null

    if (phase1Res && phase1Res.ok) {
      phase1Data = await phase1Res.json()

      if (provider === 'Anthropic') {
        // Anthropic: look for tool_use block
        const toolBlock = phase1Data.content?.find(b => b.type === 'tool_use' && b.name === 'write_file')
        if (toolBlock) toolCall = { path: toolBlock.input.path, content: toolBlock.input.content, explanation: toolBlock.input.explanation, toolUseId: toolBlock.id }
      } else {
        // OpenAI/LiteLLM: look for tool_calls
        const tc = phase1Data.choices?.[0]?.message?.tool_calls?.[0]
        if (tc?.function?.name === 'write_file') {
          try {
            const args = JSON.parse(tc.function.arguments)
            toolCall = { ...args, toolCallId: tc.id }
          } catch { /* malformed args */ }
        }
      }
    }

    // ── Execute the tool call if present ──────────────────────────────────
    if (toolCall) {
      let writeError = null
      let writtenPath = null
      try {
        writtenPath = await safeWriteFile(toolCall.path, toolCall.content, projectDir)
        // Notify frontend — editor will reload via fs.watch
        send('file_written', {
          path: toolCall.path,
          fullPath: writtenPath,
          explanation: toolCall.explanation,
          projectDir: projectDir || null,
        })
      } catch (err) {
        writeError = err.message
        send('file_write_error', { path: toolCall.path, error: writeError })
      }

      // ── Phase 2: send tool result back to get confirmation message ──────
      let phase2Res
      const toolResult = writeError
        ? `Error writing file: ${writeError}`
        : `Successfully wrote ${toolCall.content.split('\n').length} lines to ${toolCall.path}.`

      if (provider === 'Anthropic') {
        const phase2Messages = [
          ...messages,
          { role: 'assistant', content: phase1Data.content },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolCall.toolUseId, content: toolResult }] },
        ]
        phase2Res = await fetch(`${baseUrl}/anthropic/v1/messages`, {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: 1024, stream: true, system: systemPrompt, messages: phase2Messages }),
        })
      } else {
        const endpoint = provider === 'OpenAI'
          ? `${baseUrl}/openai/v1/chat/completions`
          : `${baseUrl}/litellm/v1/chat/completions`
        const allMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages
        const phase2Messages = [
          ...allMessages,
          phase1Data.choices[0].message,
          { role: 'tool', tool_call_id: toolCall.toolCallId, content: toolResult },
        ]
        phase2Res = await fetch(endpoint, {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: phase2Messages, stream: true, max_tokens: 1024 }),
        })
      }

      // Stream the confirmation response
      if (phase2Res?.ok) {
        await streamResponse(phase2Res, provider, send)
      }
      send('done', {})
      res.end()
      return
    }

    // ── No tool call — fall back to normal streaming ───────────────────────
    // Re-issue as streaming request
    let streamRes
    if (provider === 'Anthropic') {
      streamRes = await fetch(`${baseUrl}/anthropic/v1/messages`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ ...phase1Body, stream: true }),
      })
    } else if (provider === 'Gemini') {
      const geminiMessages = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      streamRes = await fetch(`${baseUrl}/gemini/v1beta/models/${model}:streamGenerateContent`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: geminiMessages, systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined, generationConfig: { maxOutputTokens: 2048 } }),
      })
    } else {
      const endpoint = provider === 'OpenAI' ? `${baseUrl}/openai/v1/chat/completions` : `${baseUrl}/litellm/v1/chat/completions`
      const allMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages
      streamRes = await fetch(endpoint, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: allMessages, stream: true, max_tokens: 2048 }),
      })
    }

    if (!streamRes.ok) {
      const err = await streamRes.text()
      send('error', `LLM error ${streamRes.status}: ${err}`)
      res.end()
      return
    }

    await streamResponse(streamRes, provider, send)
    send('done', {})
    res.end()

  } catch (err) {
    send('error', err.message)
    res.end()
  }
})

// ── Helper: stream tokens from an upstream SSE response ─────────────────────
async function streamResponse(upstreamRes, provider, send) {
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
      if (!trimmed.startsWith('data: ')) continue
      try {
        const json = JSON.parse(trimmed.slice(6))
        let text = ''
        if (provider === 'Anthropic') {
          if (json.type === 'content_block_delta') text = json.delta?.text || ''
        } else if (provider === 'Gemini') {
          text = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
        } else {
          text = json.choices?.[0]?.delta?.content || ''
        }
        if (text) send('token', text)
      } catch { /* skip */ }
    }
  }
}
