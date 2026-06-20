import { useState, useEffect, useCallback } from 'react'
import type { DirEntry } from '../../lib/api'
import * as api from '../../lib/api'
import './FileExplorer.css'

interface FileExplorerProps {
  onOpenFile: (path: string) => void
  activeFilePath: string | null
  // Refresh signal — increment to force a reload of the tree
  refreshKey?: number
}

const FILE_ICONS: Record<string, string> = {
  '.cds': '📋', '.yml': '⚡', '.yaml': '⚡', '.json': '{}',
  '.ts': '🔷', '.tsx': '🔷', '.js': '🟨', '.jsx': '🟨',
  '.md': '📝', '.sh': '🐚', '.xml': '📄', '.css': '🎨',
  '.csv': '📊', '.mtar': '📦', '.gitignore': '🚫',
}

function fileIcon(entry: DirEntry): string {
  if (entry.type === 'dir') return '📁'
  return FILE_ICONS[entry.ext ?? ''] ?? '📄'
}

interface TreeNodeProps {
  node: DirEntry
  depth: number
  activeFilePath: string | null
  onOpenFile: (path: string) => void
}

function TreeNode({ node, depth, activeFilePath, onOpenFile }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0)

  const isActive = node.type === 'file' && node.path === activeFilePath

  if (node.type === 'dir') {
    return (
      <div className="fe-tree-node">
        <button
          className={`fe-tree-row fe-tree-dir ${expanded ? 'expanded' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => setExpanded(e => !e)}
        >
          <span className="fe-tree-arrow">{expanded ? '▾' : '▸'}</span>
          <span className="fe-tree-icon">📁</span>
          <span className="fe-tree-name">{node.name}</span>
        </button>
        {expanded && node.children?.map(child => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            onOpenFile={onOpenFile}
          />
        ))}
      </div>
    )
  }

  return (
    <button
      className={`fe-tree-row fe-tree-file ${isActive ? 'active' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 + 16 }}
      onClick={() => onOpenFile(node.path)}
      title={node.path}
    >
      <span className="fe-tree-icon">{fileIcon(node)}</span>
      <span className="fe-tree-name">{node.name}</span>
    </button>
  )
}

export default function FileExplorer({ onOpenFile, activeFilePath, refreshKey }: FileExplorerProps) {
  const [tree, setTree] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    api.listDirTree('')
      .then(items => setTree(items))
      .catch(() => setTree([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload, refreshKey])

  return (
    <div className={`file-explorer ${collapsed ? 'collapsed' : ''}`}>
      <div className="fe-header" onClick={() => setCollapsed(c => !c)}>
        <span className="fe-header-icon">🗂</span>
        <span className="fe-header-title">Files</span>
        <div className="fe-header-actions" onClick={e => e.stopPropagation()}>
          <button className="fe-refresh-btn" onClick={reload} title="Refresh" disabled={loading}>
            {loading ? '⟳' : '↺'}
          </button>
          <span className="fe-collapse-arrow">{collapsed ? '▲' : '▼'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="fe-tree">
          {loading && tree.length === 0 ? (
            <div className="fe-empty">Loading…</div>
          ) : tree.length === 0 ? (
            <div className="fe-empty">No project files yet.<br />Complete a lesson step to create files.</div>
          ) : (
            tree.map(node => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                activeFilePath={activeFilePath}
                onOpenFile={onOpenFile}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
