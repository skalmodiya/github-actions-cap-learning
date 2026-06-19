import './Header.css'

interface HeaderProps {
  onSettingsClick: () => void
  showingSettings: boolean
}

export default function Header({ onSettingsClick, showingSettings }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-logo">
        <span className="header-icon">🚀</span>
        <span className="header-title">GitHub Actions</span>
        <span className="header-subtitle">SAP BTP Learning</span>
      </div>
      <div className="header-actions">
        <a
          href="https://docs.github.com/en/actions"
          target="_blank"
          rel="noreferrer"
          className="header-link"
        >
          GHA Docs
        </a>
        <a
          href="https://cap.cloud.sap/docs/"
          target="_blank"
          rel="noreferrer"
          className="header-link"
        >
          CAP Docs
        </a>
        <button
          onClick={onSettingsClick}
          className={showingSettings ? 'active' : ''}
          title="Settings"
        >
          ⚙ Settings
        </button>
      </div>
    </header>
  )
}
