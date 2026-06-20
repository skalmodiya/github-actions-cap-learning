import { useAppState } from '../../context/AppStateContext'
import FileExplorer from './FileExplorer'
import GHAStatusPanel from '../github/GHAStatusPanel'
import './Sidebar.css'

interface SidebarProps {
  onOpenFile: (path: string) => void
  activeExplorerFile: string | null
  explorerRefresh: number
}

export default function Sidebar({ onOpenFile, activeExplorerFile, explorerRefresh }: SidebarProps) {
  const { state, dispatch } = useAppState()

  return (
    <aside className="sidebar">
      {/* Module list — compact, names only */}
      <div className="sidebar-modules">
        {state.modules.map(module => {
          const isActive = module.id === state.activeModuleId
          const completedCount = module.steps.filter(s =>
            state.progress.completedSteps.includes(s.id)
          ).length
          const allDone = completedCount === module.steps.length

          return (
            <button
              key={module.id}
              className={`sidebar-module-btn ${isActive ? 'active' : ''} ${allDone ? 'done' : ''}`}
              onClick={() => dispatch({ type: 'SET_MODULE', moduleId: module.id })}
              title={module.description}
            >
              <span className="module-btn-icon">{module.icon}</span>
              <span className="module-btn-title">{module.title}</span>
              <span className="module-btn-badge">
                {allDone ? '✓' : `${completedCount}/${module.steps.length}`}
              </span>
            </button>
          )
        })}
      </div>

      {/* GitHub Actions live status */}
      <GHAStatusPanel />

      {/* File Explorer — fills remaining space */}
      <FileExplorer
        onOpenFile={onOpenFile}
        activeFilePath={activeExplorerFile}
        refreshKey={explorerRefresh}
        fillHeight
      />
    </aside>
  )
}
