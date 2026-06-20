import type { Module } from '../types'

export const btpDeployModule: Module = {
  id: '03-btp-deploy',
  title: 'BTP CF Deployment',
  icon: '🚀',
  description: 'Build and deploy your CAP app to SAP BTP Cloud Foundry',
  steps: [
    {
      id: '03-btp-step-1',
      title: 'BTP Deployment Overview',
      contextHints: ['Cloud Foundry', 'MTA', 'mtar', 'cf CLI', 'BTP subaccount', 'space', 'org', 'deploy'],
      completionCriteria: 'Understand the MTA build and deploy flow',
      blocks: [
        {
          kind: 'markdown',
          content: `## Deploying CAP to SAP BTP Cloud Foundry

SAP BTP uses the **Multi-Target Application (MTA)** format for deployments. An MTA bundles all your microservices and configurations into a single \`.mtar\` archive.

### The Deployment Flow

\`\`\`
Your CAP project
      │
      ▼ cds build
  Compiled CDS artifacts (db/, srv/)
      │
      ▼ mbt build
  app.mtar  (the deployment archive)
      │
      ▼ cf deploy
  BTP Cloud Foundry
      ├── your-srv app (Node.js)
      ├── your-db (HDI container / HANA)
      └── xsuaa service (auth)
\`\`\`

### Tools Required

| Tool | Install | Purpose |
|---|---|---|
| \`cf\` CLI | [Download](https://github.com/cloudfoundry/cli/releases) | Interact with Cloud Foundry |
| \`mbt\` | \`npm install -g mbt\` | Build .mtar archives |
| \`@sap/cds-dk\` | \`npm install -g @sap/cds-dk\` | CAP build tooling |

### BTP CF Concepts

| Term | Meaning |
|---|---|
| **Org** | Your company's BTP account (e.g. \`mycompany\`) |
| **Space** | Environment within org (e.g. \`dev\`, \`prod\`) |
| **App** | A deployed Node.js/Java service |
| **Service** | Managed service instance (HANA, XSUAA, etc.) |
| **Binding** | Connecting an app to a service |`,
        },
      ],
    },
    {
      id: '03-btp-step-2',
      title: 'Install CF CLI and MBT',
      contextHints: ['cf version', 'mbt --version', 'cf CLI install', 'mbt install', 'npm install -g mbt'],
      completionCriteria: 'Run both verify commands and confirm tools are installed',
      blocks: [
        {
          kind: 'markdown',
          content: `## Install Required Tools

### CF CLI (Cloud Foundry CLI)
Download and install from the [CF CLI releases page](https://github.com/cloudfoundry/cli/releases).
On Windows, download the installer. On Mac: \`brew install cloudfoundry/tap/cf-cli@8\`.

After installing, verify:`,
        },
        {
          kind: 'run',
          label: 'Verify CF CLI is installed',
          command: 'cf version',
        },
        {
          kind: 'markdown',
          content: `### MBT — Multi-Target Application Build Tool

MBT is published on npm:`,
        },
        {
          kind: 'run',
          label: 'Install MBT globally',
          command: 'npm install -g mbt',
        },
        {
          kind: 'run',
          label: 'Verify MBT is installed',
          command: 'mbt --version',
        },
      ],
    },
    {
      id: '03-btp-step-3',
      title: 'Create mta.yaml',
      contextHints: ['mta.yaml', 'MTA descriptor', 'modules', 'resources', 'hdi-container', 'xsuaa', 'nodejs'],
      completionCriteria: 'Set your CAP project folder, then save mta.yaml',
      blocks: [
        {
          kind: 'markdown',
          content: `## The mta.yaml File

The \`mta.yaml\` (Multi-Target Application descriptor) defines your entire application topology:
- What gets deployed (modules = apps)
- What gets created (resources = BTP services)
- How they connect (requires/provides)

First, point to the CAP project you created in Module 2:`,
        },
        {
          kind: 'dirpicker',
          label: 'Which CAP project folder to deploy?',
          description: 'Enter the folder name you used in Module 2 (e.g. "my-bookshop"). All build and deploy commands will run inside it.',
        },
        {
          kind: 'markdown',
          content: `Now edit \`mta.yaml\` inside that project folder:`,
        },
        {
          kind: 'editor',
          path: 'mta.yaml',
          language: 'yaml',
          description: 'MTA descriptor for your CAP application',
          useProjectDir: true,
          defaultContent: `_schema-version: '3.1'
ID: my-bookshop
version: 1.0.0
description: My CAP Bookshop Application

modules:
  # The Node.js backend service
  - name: my-bookshop-srv
    type: nodejs
    path: gen/srv
    parameters:
      buildpack: nodejs_buildpack
      memory: 256M
    requires:
      - name: my-bookshop-db
      - name: my-bookshop-auth
    provides:
      - name: srv-api
        properties:
          srv-url: '\${default-url}'

  # Database deployer (runs once, then stops)
  - name: my-bookshop-db-deployer
    type: hdb
    path: gen/db
    parameters:
      buildpack: nodejs_buildpack
    requires:
      - name: my-bookshop-db

resources:
  # SAP HANA Cloud HDI Container
  - name: my-bookshop-db
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared

  # XSUAA (authentication)
  - name: my-bookshop-auth
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json
`,
        },
        {
          kind: 'markdown',
          content: `### Key mta.yaml Sections

**Modules** = things that get deployed (apps):
- \`type: nodejs\` → Node.js app pushed to CF
- \`type: hdb\` → Database schema deployer
- \`path:\` → where the built artifact lives (after \`cds build\`)

**Resources** = BTP services to create/bind:
- \`com.sap.xs.hdi-container\` → HANA Cloud database
- \`org.cloudfoundry.managed-service\` → Any CF marketplace service

**requires/provides** = wiring between modules and resources`,
        },
        {
          kind: 'run',
          label: 'Create xs-security.json (XSUAA config)',
          useProjectDir: true,
          command: `cat > xs-security.json << 'EOF'
{
  "xsappname": "my-bookshop",
  "tenant-mode": "dedicated",
  "description": "Security config for my bookshop",
  "scopes": [],
  "role-templates": []
}
EOF`,
        },
      ],
    },
    {
      id: '03-btp-step-4',
      title: 'Build the MTAR Archive',
      contextHints: ['cds build', 'mbt build', 'gen/', 'mtar_archives', '.mtar file', 'build artifacts'],
      completionCriteria: 'Successfully build the .mtar archive',
      blocks: [
        {
          kind: 'markdown',
          content: `## Build Your Application

Building happens in two stages:

**Stage 1: \`cds build\`** — compiles CDS to database and service artifacts
**Stage 2: \`mbt build\`** — packages everything into a single \`.mtar\` file`,
        },
        {
          kind: 'run',
          label: 'Stage 1 — CDS build',
          command: 'cds build --production',
          useProjectDir: true,
        },
        {
          kind: 'run',
          label: 'Verify gen/ folder was created',
          command: 'find gen/ -type f | head -20',
          useProjectDir: true,
        },
        {
          kind: 'run',
          label: 'Stage 2 — MBT build (creates .mtar)',
          command: 'mbt build -t ./mta_archives',
          useProjectDir: true,
        },
        {
          kind: 'run',
          label: 'Verify .mtar archive was created',
          command: 'ls -lh mta_archives/',
          useProjectDir: true,
        },
        {
          kind: 'markdown',
          content: `After both stages succeed, you'll have:
\`\`\`
mta_archives/
└── my-bookshop_1.0.0.mtar   ← ready to deploy!
\`\`\`

This \`.mtar\` file is everything CF needs to deploy your entire application stack.`,
        },
      ],
    },
    {
      id: '03-btp-step-5',
      title: 'Login to Cloud Foundry',
      contextHints: ['cf login', 'API endpoint', 'org', 'space', 'cf target', 'SSO', 'cf apps', 'token expired'],
      completionCriteria: 'Run cf target and see your org and space',
      blocks: [
        {
          kind: 'markdown',
          content: `## Login to Cloud Foundry

> **Token expired?** If you see _"The token expired, was revoked, or the token ID is incorrect"_, just re-run the login command below — your session expired and you need to re-authenticate.

### Step 1 — Check if you're already logged in`,
        },
        {
          kind: 'run',
          label: 'Check current CF session',
          command: 'cf target',
        },
        {
          kind: 'markdown',
          content: `### Step 2 — Login

> ⚠ **The \`--sso\` flag requires interactive input** (paste a passcode) which doesn't work in this embedded terminal. Use one of the non-interactive methods below instead.

**Click ✏ on the command below** to replace \`your@email.com\` and \`yourpassword\` with your SAP BTP credentials, and change the API URL to your region if needed.

#### Common CF API Endpoints by Region

| Region | API Endpoint |
|---|---|
| **US10** (East US) | \`https://api.cf.us10.hana.ondemand.com\` |
| EU10 (Frankfurt) | \`https://api.cf.eu10.hana.ondemand.com\` |
| AP10 (Australia) | \`https://api.cf.ap10.hana.ondemand.com\` |
| EU20 (Netherlands) | \`https://api.cf.eu20.hana.ondemand.com\` |
| US20 (West US) | \`https://api.cf.us20.hana.ondemand.com\` |

> **Tip:** Find your exact API URL in **BTP Cockpit** → Subaccount → Cloud Foundry → API Endpoint`,
        },
        {
          kind: 'run',
          label: 'Login to Cloud Foundry',
          command: 'cf login -a https://api.cf.us10.hana.ondemand.com -u your@email.com -p yourpassword',
        },
        {
          kind: 'markdown',
          content: `### SSO Login (outside this app)

If you prefer SSO, run this **in your own terminal** (not here):
\`\`\`bash
cf login -a https://api.cf.us10.hana.ondemand.com --sso
\`\`\`
It will give you a URL — open it in a browser, get the passcode, paste it back.

### For CI/CD (GitHub Actions)
Use secrets — never hardcode credentials in workflow files:
\`\`\`bash
cf login -a \$CF_API -u \$CF_USERNAME -p \$CF_PASSWORD -o \$CF_ORG -s \$CF_SPACE
\`\`\``,
        },
        {
          kind: 'run',
          label: 'Verify login — show target org & space',
          command: 'cf target',
        },
        {
          kind: 'markdown',
          content: `### Switching org / space

\`cf target\` with flags lets you switch without re-logging in.
Click **✏** to set your org and space names:`,
        },
        {
          kind: 'run',
          label: 'Switch org and space',
          command: 'cf target -o your-org -s your-space',
        },
        {
          kind: 'markdown',
          content: `You can also switch just one at a time:
\`\`\`bash
cf target -s Dev          # switch space only
cf target -o my-org       # switch org only (resets space)
\`\`\`

To list all available orgs and spaces you have access to:`,
        },
        {
          kind: 'run',
          label: 'List orgs',
          command: 'cf orgs',
        },
        {
          kind: 'run',
          label: 'List spaces in current org',
          command: 'cf spaces',
        },
        {
          kind: 'run',
          label: 'List apps in current space',
          command: 'cf apps',
        },
      ],
    },
    {
      id: '03-btp-step-6',
      title: 'Write the GitHub Actions Deploy Workflow',
      contextHints: ['cf deploy', 'mtar', 'GitHub Actions workflow', 'secrets', 'CD pipeline', 'deploy.yml'],
      completionCriteria: 'Create and save .github/workflows/deploy.yml',
      blocks: [
        {
          kind: 'markdown',
          content: `## Automate Deployment with GitHub Actions

Now that you understand both CAP and CF deployment, let's create the GitHub Actions workflow that does it all automatically on every push to \`main\`.`,
        },
        {
          kind: 'run',
          label: 'Ensure workflows directory exists',
          command: 'mkdir -p .github/workflows',
        },
        {
          kind: 'editor',
          path: '.github/workflows/deploy.yml',
          language: 'yaml',
          description: 'Complete CI/CD pipeline: build + deploy to BTP CF',
          defaultContent: `name: Build and Deploy to SAP BTP

on:
  push:
    branches: [ main ]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'dev'
        type: choice
        options: [ dev, prod ]

env:
  CF_API: https://api.cf.us10.hana.ondemand.com  # ✏ change to your region's endpoint
  CF_ORG: \${{ secrets.CF_ORG }}

jobs:
  # ─── Job 1: Run Tests ────────────────────────────────────────
  test:
    name: 🧪 Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test --if-present

  # ─── Job 2: Build MTAR ───────────────────────────────────────
  build:
    name: 🔨 Build MTAR
    runs-on: ubuntu-latest
    needs: test

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install MBT
        run: npm install -g mbt

      - name: Install CDS
        run: npm install -g @sap/cds-dk

      - name: CDS Build
        run: cds build --production

      - name: MBT Build
        run: mbt build -t ./mta_archives

      - name: Upload MTAR artifact
        uses: actions/upload-artifact@v4
        with:
          name: mtar-archive
          path: mta_archives/*.mtar
          retention-days: 5

  # ─── Job 3: Deploy to Dev ────────────────────────────────────
  deploy-dev:
    name: 🚀 Deploy to Dev
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: dev          # requires "dev" environment in repo settings

    steps:
      - name: Download MTAR
        uses: actions/download-artifact@v4
        with:
          name: mtar-archive
          path: mta_archives/

      - name: Install CF CLI
        run: |
          curl -L "https://packages.cloudfoundry.org/stable?release=linux64-binary&version=v8&source=github" | tar -zx
          sudo mv cf8 /usr/local/bin/cf

      - name: CF Login
        run: |
          cf login \\
            -a \${{ env.CF_API }} \\
            -u \${{ secrets.CF_USERNAME }} \\
            -p \${{ secrets.CF_PASSWORD }} \\
            -o \${{ env.CF_ORG }} \\
            -s \${{ secrets.CF_SPACE_DEV }}

      - name: Deploy
        run: cf deploy mta_archives/*.mtar --version-rule ALL

      - name: CF Logout
        if: always()
        run: cf logout
`,
        },
        {
          kind: 'markdown',
          content: `### What this workflow does

1. **Test job** — installs deps, runs \`npm test\`
2. **Build job** — runs \`cds build\` + \`mbt build\`, uploads the \`.mtar\` as an artifact
3. **Deploy job** — downloads the artifact, installs CF CLI, logs in, deploys

### Required Secrets to Configure in GitHub

Go to **Repository → Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| \`CF_ORG\` | Your BTP CF org name |
| \`CF_USERNAME\` | SAP BTP technical user email |
| \`CF_PASSWORD\` | Technical user password |
| \`CF_SPACE_DEV\` | Dev space name (e.g. \`dev\`) |

### Next Steps
- Add a \`deploy-prod\` job with \`environment: prod\` (requires manual approval)
- Add \`paths:\` filter so deploy only triggers when src files change
- Add Slack notifications on deployment success/failure`,
        },
      ],
    },
  ],
}
