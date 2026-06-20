import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import type { Module, ProgressState } from '../types'
import { MODULE_LIST } from '../lessons/index'
import * as api from '../lib/api'

interface AppState {
  modules: Module[]
  activeModuleId: string
  activeStepIndex: number
  progress: ProgressState
  isAIChatOpen: boolean
  openFilePath: string | null
  openFileContent: string
  terminalVisible: boolean
  // Per-module chosen project directory (relative to WORK_DIR, e.g. "my-bookshop")
  projectDirs: Record<string, string>
}

type Action =
  | { type: 'SET_MODULE'; moduleId: string }
  | { type: 'SET_STEP'; index: number }
  | { type: 'MARK_COMPLETE'; stepId: string }
  | { type: 'UNMARK_COMPLETE'; stepId: string }
  | { type: 'TOGGLE_AI' }
  | { type: 'SET_OPEN_FILE'; path: string | null; content: string }
  | { type: 'SET_TERMINAL_VISIBLE'; visible: boolean }
  | { type: 'LOAD_PROGRESS'; progress: ProgressState }
  | { type: 'SET_PROJECT_DIR'; moduleId: string; dir: string }

const initialProgress: ProgressState = {
  completedSteps: [],
  lastModuleId: MODULE_LIST[0]?.id ?? '',
  lastStepId: '',
}

const initialState: AppState = {
  modules: MODULE_LIST,
  activeModuleId: MODULE_LIST[0]?.id ?? '',
  activeStepIndex: 0,
  progress: initialProgress,
  isAIChatOpen: false,
  openFilePath: null,
  openFileContent: '',
  terminalVisible: true,
  projectDirs: {},
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_MODULE':
      return {
        ...state,
        activeModuleId: action.moduleId,
        activeStepIndex: 0,
        isAIChatOpen: false,
        openFilePath: null,
        openFileContent: '',
      }
    case 'SET_STEP':
      return { ...state, activeStepIndex: action.index }
    case 'MARK_COMPLETE': {
      const completed = state.progress.completedSteps.includes(action.stepId)
        ? state.progress.completedSteps
        : [...state.progress.completedSteps, action.stepId]
      return {
        ...state,
        progress: {
          ...state.progress,
          completedSteps: completed,
          lastModuleId: state.activeModuleId,
          lastStepId: action.stepId,
        },
      }
    }
    case 'UNMARK_COMPLETE':
      return {
        ...state,
        progress: {
          ...state.progress,
          completedSteps: state.progress.completedSteps.filter(id => id !== action.stepId),
        },
      }
    case 'TOGGLE_AI':
      return { ...state, isAIChatOpen: !state.isAIChatOpen }
    case 'SET_OPEN_FILE':
      return { ...state, openFilePath: action.path, openFileContent: action.content }
    case 'SET_TERMINAL_VISIBLE':
      return { ...state, terminalVisible: action.visible }
    case 'SET_PROJECT_DIR':
      return {
        ...state,
        projectDirs: { ...state.projectDirs, [action.moduleId]: action.dir },
      }
    case 'LOAD_PROGRESS': {
      const lastModuleId = action.progress.lastModuleId || state.activeModuleId
      const lastModule = MODULE_LIST.find(m => m.id === lastModuleId)
      const lastStepIndex = lastModule
        ? lastModule.steps.findIndex(s => s.id === action.progress.lastStepId)
        : 0
      return {
        ...state,
        progress: action.progress,
        activeModuleId: lastModuleId,
        activeStepIndex: Math.max(0, lastStepIndex),
      }
    }
    default:
      return state
  }
}

interface AppStateContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  activeModule: Module | undefined
  activeStep: Module['steps'][number] | undefined
  // Resolved project directory for the active module (empty string = WORK_DIR root)
  activeProjectDir: string
}

const AppStateContext = createContext<AppStateContextValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Load progress on mount
  useEffect(() => {
    api.getProgress().then(p => dispatch({ type: 'LOAD_PROGRESS', progress: p })).catch(() => {})
  }, [])

  // Debounced progress save
  useEffect(() => {
    const timer = setTimeout(() => {
      api.saveProgress(state.progress).catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [state.progress])

  const activeModule = state.modules.find(m => m.id === state.activeModuleId)
  const activeStep = activeModule?.steps[state.activeStepIndex]
  const activeProjectDir = state.projectDirs[state.activeModuleId] ?? ''

  return (
    <AppStateContext.Provider value={{ state, dispatch, activeModule, activeStep, activeProjectDir }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
