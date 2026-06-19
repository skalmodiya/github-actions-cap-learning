import type { Module } from '../types'

export const ghaBasicsModule: Module = {
  id: '01-gha-basics',
  title: 'GitHub Actions Basics',
  icon: '⚡',
  description: 'Learn the core concepts of GitHub Actions CI/CD',
  steps: [
    {
      id: '01-gha-step-1',
      title: 'What is GitHub Actions?',
      contextHints: ['CI/CD', 'automation', 'workflow', 'repository', 'pipeline'],
      completionCriteria: 'Read through the concepts and click Next when ready',
      blocks: [
        {
          kind: 'markdown',
          content: `## What is GitHub Actions?

GitHub Actions is a **CI/CD (Continuous Integration / Continuous Delivery) platform** built directly into GitHub. It lets you automate workflows — from testing code on every pull request to deploying your SAP CAP app to BTP on every merge.

### The Big Picture

\`\`\`
Developer pushes code
        ↓
GitHub detects the push
        ↓
GitHub Actions triggers a workflow
        ↓
A "runner" (virtual machine) spins up
        ↓
Your steps execute (build, test, deploy)
        ↓
You get a pass ✓ or fail ✗ result
\`\`\`

### Why it matters for SAP BTP

In the BTP context, GitHub Actions can:
- **Build** your CAP app (\`cds build\`, \`mbt build\`)
- **Test** before deploying (run \`npm test\`)
- **Deploy** to Cloud Foundry (\`cf deploy\`)
- **Automate** service bindings and configuration

### Key Concepts

| Term | Meaning |
|------|---------|
| **Workflow** | A YAML file defining automation, lives in \`.github/workflows/\` |
| **Trigger (event)** | What starts the workflow — a push, PR, schedule, etc. |
| **Job** | A group of steps that run on one machine |
| **Step** | A single command or reusable action |
| **Runner** | The virtual machine that executes jobs |
| **Action** | A reusable unit — like \`actions/checkout\` |
| **Secret** | Encrypted variable for API keys and passwords |`,
        },
      ],
    },
    {
      id: '01-gha-step-2',
      title: 'Workflow File Anatomy',
      contextHints: ['YAML', 'workflow file', '.github/workflows', 'syntax', 'name', 'on', 'jobs'],
      completionCriteria: 'Study the YAML structure and understand each section',
      blocks: [
        {
          kind: 'markdown',
          content: `## Anatomy of a Workflow File

Every workflow is a YAML file stored in \`.github/workflows/\` in your repo.
Here's a complete annotated example:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          filename: '.github/workflows/example.yml',
          content: `# Workflow name — shows up in the GitHub UI
name: My First Workflow

# TRIGGERS — when does this run?
on:
  push:
    branches: [ main ]        # runs on push to main
  pull_request:               # runs on any PR
  workflow_dispatch:          # allows manual trigger from GitHub UI

# JOBS — one or more parallel or sequential jobs
jobs:
  build-and-test:             # job ID (you name this)
    name: Build and Test      # display name
    runs-on: ubuntu-latest    # runner OS

    steps:
      # Step 1: Check out your code
      - name: Checkout code
        uses: actions/checkout@v4

      # Step 2: Set up Node.js
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      # Step 3: Install dependencies
      - name: Install dependencies
        run: npm install

      # Step 4: Run tests
      - name: Run tests
        run: npm test

  deploy:
    name: Deploy to BTP
    runs-on: ubuntu-latest
    needs: build-and-test     # ← only runs if build-and-test succeeds
    if: github.ref == 'refs/heads/main'   # ← only on main branch

    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: |
          cf login -a \${{ secrets.CF_API }} -u \${{ secrets.CF_USER }} -p \${{ secrets.CF_PASSWORD }} -o \${{ secrets.CF_ORG }} -s \${{ secrets.CF_SPACE }}
          cf deploy mta_archives/app.mtar`,
        },
        {
          kind: 'markdown',
          content: `### Key YAML Rules

- **Indentation** = 2 spaces (never tabs)
- \`on:\` defines triggers
- \`jobs:\` is a map of job-id → job definition
- \`steps:\` is an ordered list (use \`-\`)
- \`uses:\` references a reusable Action
- \`run:\` executes a shell command
- \`\${{ }}\` is the expression syntax for variables and secrets`,
        },
      ],
    },
    {
      id: '01-gha-step-3',
      title: 'Triggers — When Workflows Run',
      contextHints: ['on:', 'push', 'pull_request', 'workflow_dispatch', 'schedule', 'branches', 'tags'],
      completionCriteria: 'Understand the 4 main trigger types',
      blocks: [
        {
          kind: 'markdown',
          content: `## Triggers (\`on:\`)

The \`on:\` key tells GitHub Actions **when** to run your workflow.

### Most Common Triggers`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `# 1. Push — runs when code is pushed
on:
  push:
    branches: [ main, develop ]
    paths:
      - 'srv/**'              # only if files in srv/ changed
      - 'db/**'

# 2. Pull Request — runs when a PR is opened/updated
on:
  pull_request:
    branches: [ main ]
    types: [ opened, synchronize, reopened ]

# 3. Manual trigger — adds a "Run workflow" button in GitHub UI
on:
  workflow_dispatch:
    inputs:
      environment:            # optional input for manual runs
        description: 'Target environment'
        required: true
        default: 'dev'
        type: choice
        options: [ dev, staging, prod ]

# 4. Schedule — cron syntax (UTC)
on:
  schedule:
    - cron: '0 2 * * 1-5'   # 2am UTC on weekdays

# 5. Multiple triggers combined (very common)
on:
  push:
    branches: [ main ]
  pull_request:
  workflow_dispatch:`,
        },
        {
          kind: 'markdown',
          content: `### BTP-Specific Pattern

A typical BTP project uses this trigger setup:

| Branch/Event | What happens |
|---|---|
| PR opened | Run \`cds lint\` + tests |
| Push to \`main\` | Deploy to **dev** space |
| Push to \`release\` | Deploy to **prod** space |
| Manual dispatch | Re-deploy with env selector |`,
        },
      ],
    },
    {
      id: '01-gha-step-4',
      title: 'Jobs & Steps — Runner Selection',
      contextHints: ['jobs', 'runs-on', 'ubuntu-latest', 'needs', 'steps', 'uses', 'run', 'env', 'with'],
      completionCriteria: 'Understand job dependencies and step types',
      blocks: [
        {
          kind: 'markdown',
          content: `## Jobs & Steps

### Runners

The \`runs-on:\` key selects the virtual machine type.
For BTP/CAP deployments, \`ubuntu-latest\` is the standard choice — it has Node.js, bash, curl, and all common tools available.

\`\`\`yaml
runs-on: ubuntu-latest    # ← use this for BTP work
runs-on: windows-latest   # ← not needed for CF deployments
runs-on: macos-latest     # ← not needed for CF deployments
\`\`\`

### Job Dependencies with \`needs:\`

Jobs run **in parallel** by default. Use \`needs:\` to make jobs sequential:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm test

  build:
    runs-on: ubuntu-latest
    needs: test             # ← waits for test to pass
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm run build
      - run: mbt build

  deploy-dev:
    runs-on: ubuntu-latest
    needs: build            # ← waits for build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Dev
        run: cf deploy mta_archives/*.mtar
        env:
          CF_API: \${{ secrets.CF_API_DEV }}`,
        },
        {
          kind: 'markdown',
          content: `### Step Types

**\`uses:\`** — runs a pre-built Action from the marketplace:
\`\`\`yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: '20'
\`\`\`

**\`run:\`** — runs shell commands directly:
\`\`\`yaml
- name: Install and build
  run: |
    npm install
    npm run build
    mbt build
\`\`\`

**Useful environment variables available in every job:**
| Variable | Value |
|---|---|
| \`github.ref\` | e.g. \`refs/heads/main\` |
| \`github.sha\` | commit SHA |
| \`github.actor\` | user who triggered |
| \`github.run_number\` | incrementing build number |`,
        },
      ],
    },
    {
      id: '01-gha-step-5',
      title: 'Secrets — Storing BTP Credentials',
      contextHints: ['secrets', 'GITHUB_TOKEN', 'cf login', 'credentials', 'Settings', 'environment secrets'],
      completionCriteria: 'Know where to store secrets and how to reference them',
      blocks: [
        {
          kind: 'markdown',
          content: `## Secrets

Secrets store sensitive values like BTP passwords, CF API endpoints, and API keys.
They are **encrypted at rest** and **masked in logs**.

### Where to Create Secrets

**Repository secrets** (most common):
1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

**Typical secrets for a BTP CAP deployment:**

| Secret Name | Value |
|---|---|
| \`CF_API\` | \`https://api.cf.eu10.hana.ondemand.com\` |
| \`CF_ORG\` | Your CF org name |
| \`CF_SPACE_DEV\` | Your dev space name |
| \`CF_SPACE_PROD\` | Your prod space name |
| \`CF_USERNAME\` | SAP BTP email or technical user |
| \`CF_PASSWORD\` | Password |

### Using Secrets in Workflows`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `- name: Login to Cloud Foundry
  run: |
    cf login \\
      -a \${{ secrets.CF_API }} \\
      -u \${{ secrets.CF_USERNAME }} \\
      -p \${{ secrets.CF_PASSWORD }} \\
      -o \${{ secrets.CF_ORG }} \\
      -s \${{ secrets.CF_SPACE_DEV }}

# Secrets can also be passed as env vars
- name: Deploy
  env:
    CF_API: \${{ secrets.CF_API }}
    CF_ORG: \${{ secrets.CF_ORG }}
  run: ./deploy.sh`,
        },
        {
          kind: 'markdown',
          content: `### Built-in GITHUB_TOKEN

GitHub provides a \`GITHUB_TOKEN\` secret automatically — no setup needed.
It's used for operations that interact with the GitHub API (creating releases, posting PR comments, etc.):

\`\`\`yaml
- name: Create Release
  uses: actions/create-release@v1
  env:
    GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
\`\`\`

### Security Tips
- Never \`echo\` a secret — it gets masked anyway, but it's bad practice
- Use **environment secrets** for prod-only values (adds an approval gate)
- Rotate secrets regularly`,
        },
      ],
    },
    {
      id: '01-gha-step-6',
      title: 'Create Your First Workflow',
      contextHints: ['workflow file', 'hello world', '.github/workflows', 'yaml', 'git', 'push'],
      completionCriteria: 'Create and save the workflow file below, then run the git init command',
      blocks: [
        {
          kind: 'markdown',
          content: `## Create Your First Workflow

Let's create a real workflow file. This simple one will:
1. Trigger on every push to main
2. Print "Hello from GitHub Actions!"
3. Show Node.js version
4. List files in the project

First, set up the folder structure and initialize git:`,
        },
        {
          kind: 'run',
          label: 'Initialize git repository',
          command: 'git init && git branch -M main',
        },
        {
          kind: 'run',
          label: 'Create .github/workflows directory',
          command: 'mkdir -p .github/workflows',
        },
        {
          kind: 'markdown',
          content: `Now create the workflow file. Edit it below and click **Save**:`,
        },
        {
          kind: 'editor',
          path: '.github/workflows/hello.yml',
          language: 'yaml',
          description: 'Your first GitHub Actions workflow',
          defaultContent: `name: Hello GitHub Actions

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  hello:
    name: Say Hello
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Print greeting
        run: echo "Hello from GitHub Actions! 🚀"

      - name: Show environment
        run: |
          echo "Node version: $(node --version)"
          echo "NPM version: $(npm --version)"
          echo "Branch: $GITHUB_REF_NAME"
          echo "Commit: $GITHUB_SHA"

      - name: List project files
        run: ls -la
`,
        },
      ],
    },
  ],
}
