import FileExplorer from './FileExplorer'
import GHAStatusPanel from '../github/GHAStatusPanel'
import './Sidebar.css'

interface SidebarProps {
  onOpenFile: (path: string) => void
  activeExplorerFile: string | null
  explorerRefresh: number
}

export default function Sidebar({ onOpenFile, activeExplorerFile, explorerRefresh }: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* GitHub Actions live status */}
      <GHAStatusPanel />

      {/* File Explorer — takes all remaining space */}
      <FileExplorer
        onOpenFile={onOpenFile}
        activeFilePath={activeExplorerFile}
        refreshKey={explorerRefresh}
        fillHeight
      />
    </aside>
  )
}
