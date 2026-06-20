export type StepBlock =
  | { kind: 'markdown'; content: string }
  | { kind: 'code'; language: string; content: string; filename?: string }
  | { kind: 'run'; label: string; command: string; cwd?: string; useProjectDir?: boolean }
  | { kind: 'editor'; path: string; language?: string; description?: string; defaultContent?: string; useProjectDir?: boolean }
  | { kind: 'dirpicker'; label?: string; description?: string }

export interface Step {
  id: string
  title: string
  blocks: StepBlock[]
  contextHints: string[]
  completionCriteria?: string
}

export interface Module {
  id: string
  title: string
  icon: string
  description: string
  steps: Step[]
}

export interface ProgressState {
  completedSteps: string[]
  lastModuleId: string
  lastStepId: string
  updatedAt?: string
}

export type LLMProvider = 'Anthropic' | 'OpenAI' | 'Gemini' | 'LiteLLM'

export interface AppSettings {
  provider: LLMProvider
  baseUrl: string
  apiKey: string
  model: string
}

export interface TerminalLine {
  type: 'stdout' | 'stderr' | 'info' | 'error'
  text: string
}
