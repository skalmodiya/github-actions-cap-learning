import { homedir } from 'os'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Root of the project where CAP files will be created
// __dirname is app/backend/src/lib — go 4 levels up to githubActionsCAP/
export const WORK_DIR = join(__dirname, '..', '..', '..', '..')

// Settings and progress live in home dir so they survive project resets
export const SETTINGS_FILE = join(homedir(), '.githubActionsCAP-settings.json')
export const PROGRESS_FILE = join(homedir(), '.githubActionsCAP-progress.json')

// Resolve shell executable for command execution.
// IMPORTANT: On Windows with nvm4w/Git Bash Node.js, the shell path must be
// expressed as String.raw (backslashes, not forward slashes) for spawn() to
// find the executable. The SHELL env var may use forward slashes which don't work.
function resolveShell() {
  if (process.platform !== 'win32') {
    return process.env.SHELL || '/bin/bash'
  }
  // Preferred: Git for Windows bash in /bin/ (not /usr/bin/ — both work, /bin is faster)
  const candidates = [
    String.raw`C:\Program Files\Git\bin\bash.exe`,
    String.raw`C:\Program Files (x86)\Git\bin\bash.exe`,
    String.raw`C:\Git\bin\bash.exe`,
    String.raw`C:\Program Files\Git\usr\bin\bash.exe`,
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return 'bash'
}

export const SHELL_EXE = resolveShell()
