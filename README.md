# GitHub Actions + SAP BTP Learning App

An **interactive, browser-based learning environment** for mastering GitHub Actions in the context of SAP BTP (Business Technology Platform) and CAP (Cloud Application Programming Model).

Click through structured lessons, run real shell commands with a single button, edit source files directly in a Monaco editor, and ask an AI tutor questions — all from one local web app.

---

## Screenshots

### Lesson view with terminal output
![Lesson with terminal](docs/screenshot-lesson.png)

### AI Tutor chat panel
![AI Tutor](docs/screenshot-ai.png)

### Settings — LLM proxy configuration
![Settings](docs/screenshot-settings.png)

---

## Features

| Feature | Details |
|---|---|
| **Structured lessons** | 3 modules, 17 steps — GitHub Actions Basics, CAP Project Setup, BTP CF Deployment |
| **Click-to-run commands** | Every lesson step can have runnable shell commands — output streams live to a terminal panel |
| **Monaco code editor** | Edit files in-browser with syntax highlighting; saves directly to your project directory |
| **AI Tutor** | Chat with an LLM about the current step — context (module, step, open file) is injected automatically |
| **Progress tracking** | Completed steps are persisted to `~/.githubActionsCAP-progress.json` |
| **Settings page** | Connect to any LLM provider (Anthropic, OpenAI, Gemini, LiteLLM) via the Hyperspace proxy |

---

## Tech Stack

```
app/
├── backend/     Express + Node.js  (port 19110 by default)
│   └── src/
│       ├── routes/execute.js    ← SSE command runner
│       ├── routes/files.js      ← read/write project files
│       ├── routes/llm.js        ← LLM proxy (streaming)
│       ├── routes/settings.js   ← persist LLM config
│       └── routes/progress.js   ← persist lesson progress
└── frontend/    React 18 + Vite + TypeScript  (port 8765+)
    └── src/
        ├── lessons/             ← Lesson content (TypeScript modules)
        ├── components/          ← UI: Sidebar, LessonShell, RunBlock, EditorBlock, AIChatPanel, SettingsPage
        ├── context/             ← AppStateContext, SettingsContext
        └── hooks/               ← useSSE, useLLMChat
```

---

## Prerequisites

- **Node.js 18+** (tested on v24)
- **Git for Windows** (provides `bash` — required for command execution on Windows)
- **[Hyperspace LLM Proxy](http://localhost:6655)** running locally (optional — needed for AI Tutor only)

---

## Getting Started

### 1. Clone

```bash
git clone https://github.com/skalmodiya/github-actions-cap-learning.git
cd github-actions-cap-learning
```

### 2. Install dependencies

```bash
cd app/backend && npm install
cd ../frontend && npm install
```

### 3. Start

**Terminal 1 — Backend:**
```bash
cd app/backend
node src/index.js
# Listening on http://localhost:19110
```

**Terminal 2 — Frontend:**
```bash
cd app/frontend
npm run dev
# Open http://localhost:8765 (or next available port)
```

Or use the included start script (Git Bash):
```bash
bash start.sh
```

### 4. Open the app

Navigate to the URL shown by Vite (e.g. `http://localhost:8765`).

---

## Learning Modules

### ⚡ Module 1 — GitHub Actions Basics (6 steps)
| Step | What you learn |
|---|---|
| What is GitHub Actions? | CI/CD concepts, runners, triggers |
| Workflow file anatomy | YAML structure — `on`, `jobs`, `steps` |
| Triggers | `push`, `pull_request`, `workflow_dispatch`, `schedule` |
| Jobs & Steps | Runner selection, `needs:`, `uses:` vs `run:` |
| Secrets | Storing BTP credentials, `${{ secrets.X }}` |
| Your first workflow | Create `.github/workflows/hello.yml` with Monaco editor |

### 🌱 Module 2 — CAP Project Setup (6 steps)
| Step | What you learn |
|---|---|
| What is SAP CAP? | Entities, services, OData, HDI |
| Install CDS tooling | `npm install -g @sap/cds-dk`, `cds version` |
| Initialize the project | `cds init .` (structure) + `cds add nodejs` (package.json) |
| Create a data model | Edit `db/schema.cds` — Books & Authors entities |
| Create a service | Edit `srv/catalog-service.cds` — OData endpoint |
| Run locally | `cds watch` with SQLite in-memory database |

> **CDS v8+ note:** `cds init .` no longer generates `package.json`. You must run `cds add nodejs` afterward to create it with `@sap/cds ^9` and `@cap-js/sqlite`.

### 🚀 Module 3 — BTP CF Deployment (6 steps)
| Step | What you learn |
|---|---|
| BTP deployment overview | MTA format, CF orgs/spaces, deploy flow |
| Install CF CLI & MBT | `cf version`, `npm install -g mbt` |
| Create mta.yaml | MTA descriptor — modules, resources, bindings |
| Build the MTAR | `cds build --production` + `mbt build` |
| Login to Cloud Foundry | `cf login`, API endpoints by region |
| GitHub Actions deploy workflow | Full CI/CD pipeline in `.github/workflows/deploy.yml` |

---

## AI Tutor Setup

The AI Tutor connects to your local **Hyperspace LLM Proxy**.

1. Click **⚙ Settings** in the top-right corner
2. Select your preferred **Provider** (LiteLLM recommended — unified access to all models)
3. Confirm **Base URL** is `http://localhost:6655`
4. Enter your **API Key** if required
5. Click **↻ Fetch Models** to populate the model selector
6. Click **💾 Save Settings**
7. Click the **🤖 AI Tutor** tab on any lesson step

### Supported Providers

| Provider | Base URL | Chat Endpoint |
|---|---|---|
| LiteLLM | `http://localhost:6655/litellm/v1` | `POST /chat/completions` |
| Anthropic | `http://localhost:6655/anthropic/v1` | `POST /messages` |
| OpenAI | `http://localhost:6655/openai/v1` | `POST /chat/completions` |
| Gemini | `http://localhost:6655/gemini` | `POST /v1beta/models/{model}:generateContent` |

---

## Project Structure

```
githubActionsCAP/
├── app/
│   ├── backend/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js                  ← Express entry point (port 19110)
│   │       ├── lib/paths.js              ← WORK_DIR, SHELL_EXE, file paths
│   │       └── routes/
│   │           ├── execute.js            ← POST /api/execute  (SSE)
│   │           ├── files.js              ← GET/POST /api/file, GET /api/ls
│   │           ├── settings.js           ← GET/POST /api/settings
│   │           ├── progress.js           ← GET/POST /api/progress
│   │           └── llm.js                ← POST /api/llm/chat, GET /api/llm/models
│   └── frontend/
│       ├── package.json
│       ├── vite.config.ts                ← Proxies /api → backend
│       └── src/
│           ├── types.ts                  ← StepBlock, Module, Step, AppSettings
│           ├── lessons/                  ← 01-gha-basics, 02-cap-setup, 03-btp-deployment
│           ├── context/                  ← AppStateContext, SettingsContext
│           ├── hooks/                    ← useSSE, useLLMChat
│           ├── lib/api.ts                ← fetch wrappers for all backend routes
│           └── components/
│               ├── layout/               ← Header, Sidebar
│               ├── lesson/               ← LessonShell, StepView, RunBlock, EditorBlock, StepNav
│               ├── terminal/             ← TerminalPanel
│               ├── ai/                   ← AIChatPanel
│               └── settings/             ← SettingsPage
├── .gitignore
└── start.sh                              ← Start both servers (Git Bash)
```

---

## Backend API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check — returns `{ ok, cwd, shell }` |
| `/api/execute` | POST `{ command, cwd? }` | Run a shell command; SSE stream of `stdout`/`stderr`/`done` events |
| `/api/file` | GET `?path=` | Read a file from the project directory |
| `/api/file` | POST `{ path, content }` | Write a file (creates directories as needed) |
| `/api/ls` | GET `?path=` | List a directory |
| `/api/settings` | GET / POST | Read/write `~/.githubActionsCAP-settings.json` |
| `/api/progress` | GET / POST | Read/write `~/.githubActionsCAP-progress.json` |
| `/api/llm/chat` | POST `{ messages, systemPrompt }` | Proxy streaming chat to configured LLM |
| `/api/llm/models` | GET | Fetch model list from configured provider |

---

## Adding a New Lesson Module

1. Create `app/frontend/src/lessons/04-your-topic.ts`
2. Export a `Module` object (same shape as existing modules):
```typescript
import type { Module } from '../types'
export const myModule: Module = {
  id: '04-your-topic',
  title: 'Your Topic',
  icon: '🔧',
  description: '...',
  steps: [
    {
      id: '04-step-1',
      title: 'First Step',
      contextHints: ['keyword1', 'keyword2'],
      blocks: [
        { kind: 'markdown', content: `## Explanation...` },
        { kind: 'run', label: 'Run something', command: 'echo hello' },
        { kind: 'editor', path: 'myfile.yml', defaultContent: '# starter content' },
      ],
    },
  ],
}
```
3. Register it in `app/frontend/src/lessons/index.ts`:
```typescript
import { myModule } from './04-your-topic'
export const MODULE_LIST = [...existing, myModule]
```

---

## Windows Notes

Command execution uses **Git for Windows bash** (`C:\Program Files\Git\bin\bash.exe`), resolved automatically at backend startup. All lesson commands are written as bash commands — `npm`, `cds`, `cf`, `mbt`, and `git` must be on your Windows PATH.

Settings and progress are stored in your home directory (`%USERPROFILE%`) and survive project directory resets:
- `~/.githubActionsCAP-settings.json` — LLM proxy config
- `~/.githubActionsCAP-progress.json` — completed lesson steps

---

## License

MIT
