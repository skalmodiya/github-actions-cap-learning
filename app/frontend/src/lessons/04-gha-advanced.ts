import type { Module } from '../types'

export const ghaAdvancedModule: Module = {
  id: '04-gha-advanced',
  title: 'GHA Advanced Patterns',
  icon: '🔬',
  description: 'Reusable workflows, matrix builds, OIDC auth, caching, composite actions, and debugging',
  steps: [
    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Reusable Workflows
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '04-gha-step-1',
      title: 'Reusable Workflows',
      contextHints: ['workflow_call', 'reusable workflow', 'caller', 'callee', 'uses:', 'inputs', 'secrets: inherit'],
      completionCriteria: 'Create the reusable deploy workflow file',
      blocks: [
        {
          kind: 'markdown',
          content: `## Reusable Workflows

Instead of copy-pasting deploy logic across \`deploy-dev.yml\`, \`deploy-staging.yml\`, and \`deploy-prod.yml\`, extract it into one **reusable workflow** (the *callee*) and call it from thin **caller** workflows.

### How it works

\`\`\`
caller workflow               callee workflow
──────────────────            ─────────────────────────────
on: push                      on: workflow_call
  jobs:                         inputs:
    call-deploy:                  environment: ...
      uses: ./.github/          jobs:
        workflows/                deploy:
        reusable-deploy.yml         runs-on: ubuntu-latest
      with:                         steps: ...
        environment: dev
        target-space: dev
\`\`\`

### Rules for reusable workflows

- The callee must declare \`on: workflow_call\`
- Inputs and secrets are declared explicitly — the callee can't access the caller's secrets unless you pass \`secrets: inherit\` or declare them
- \`uses:\` can reference a workflow in the **same repo** (\`./\`) or a different repo (\`owner/repo/.github/workflows/file.yml@ref\`)
- You cannot nest reusable workflows more than 4 levels deep

### The callee — reusable-deploy.yml`,
        },
        {
          kind: 'code',
          language: 'yaml',
          filename: '.github/workflows/reusable-deploy.yml',
          content: `name: Reusable — Deploy to BTP CF

on:
  workflow_call:
    inputs:
      environment:
        description: 'Target environment name (used for GitHub environment protection)'
        required: true
        type: string
      target-space:
        description: 'CF space to deploy into'
        required: true
        type: string
      cf-api:
        description: 'Cloud Foundry API endpoint'
        required: false
        type: string
        default: 'https://api.cf.us10.hana.ondemand.com'
    secrets:
      CF_ORG:
        required: true
      CF_USERNAME:
        required: true
      CF_PASSWORD:
        required: true

jobs:
  deploy:
    name: Deploy to \${{ inputs.environment }}
    runs-on: ubuntu-latest
    environment: \${{ inputs.environment }}

    steps:
      - name: Download MTAR artifact
        uses: actions/download-artifact@v4
        with:
          name: mtar-archive
          path: mta_archives/

      - name: Install CF CLI
        run: |
          curl -fsSL "https://packages.cloudfoundry.org/stable?release=linux64-binary&version=v8&source=github" | tar -zx
          sudo mv cf8 /usr/local/bin/cf
          cf version

      - name: CF Login
        run: |
          cf login \\
            -a \${{ inputs.cf-api }} \\
            -u \${{ secrets.CF_USERNAME }} \\
            -p \${{ secrets.CF_PASSWORD }} \\
            -o \${{ secrets.CF_ORG }} \\
            -s \${{ inputs.target-space }}

      - name: Deploy MTAR
        run: cf deploy mta_archives/*.mtar --version-rule ALL

      - name: Show deployed apps
        run: cf apps

      - name: CF Logout
        if: always()
        run: cf logout`,
        },
        {
          kind: 'markdown',
          content: `### The caller — deploy-dev.yml

The caller workflow is now just a few lines. It triggers the build (or downloads an artifact from a previous run) and calls the reusable deploy workflow:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          filename: '.github/workflows/deploy-dev.yml',
          content: `name: Deploy to Dev

on:
  push:
    branches: [ main ]

jobs:
  build:
    name: Build MTAR
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm install -g mbt @sap/cds-dk
      - run: cds build --production
      - run: mbt build -t ./mta_archives
      - uses: actions/upload-artifact@v4
        with:
          name: mtar-archive
          path: mta_archives/*.mtar

  deploy-dev:
    name: Deploy → dev
    needs: build
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: dev
      target-space: dev
    secrets:
      CF_ORG: \${{ secrets.CF_ORG }}
      CF_USERNAME: \${{ secrets.CF_USERNAME }}
      CF_PASSWORD: \${{ secrets.CF_PASSWORD }}`,
        },
        {
          kind: 'markdown',
          content: `Now adding a staging or prod deploy is just one more \`uses:\` block — no duplicated YAML.`,
        },
        {
          kind: 'editor',
          path: '.github/workflows/reusable-deploy.yml',
          language: 'yaml',
          description: 'Reusable callee workflow — accepts environment and target-space inputs',
          defaultContent: `name: Reusable — Deploy to BTP CF

on:
  workflow_call:
    inputs:
      environment:
        description: 'Target environment name (used for GitHub environment protection)'
        required: true
        type: string
      target-space:
        description: 'CF space to deploy into'
        required: true
        type: string
      cf-api:
        description: 'Cloud Foundry API endpoint'
        required: false
        type: string
        default: 'https://api.cf.us10.hana.ondemand.com'
    secrets:
      CF_ORG:
        required: true
      CF_USERNAME:
        required: true
      CF_PASSWORD:
        required: true

jobs:
  deploy:
    name: Deploy to \${{ inputs.environment }}
    runs-on: ubuntu-latest
    environment: \${{ inputs.environment }}

    steps:
      - name: Download MTAR artifact
        uses: actions/download-artifact@v4
        with:
          name: mtar-archive
          path: mta_archives/

      - name: Install CF CLI
        run: |
          curl -fsSL "https://packages.cloudfoundry.org/stable?release=linux64-binary&version=v8&source=github" | tar -zx
          sudo mv cf8 /usr/local/bin/cf
          cf version

      - name: CF Login
        run: |
          cf login \\
            -a \${{ inputs.cf-api }} \\
            -u \${{ secrets.CF_USERNAME }} \\
            -p \${{ secrets.CF_PASSWORD }} \\
            -o \${{ secrets.CF_ORG }} \\
            -s \${{ inputs.target-space }}

      - name: Deploy MTAR
        run: cf deploy mta_archives/*.mtar --version-rule ALL

      - name: Show deployed apps
        run: cf apps

      - name: CF Logout
        if: always()
        run: cf logout
`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Matrix Builds
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '04-gha-step-2',
      title: 'Matrix Builds',
      contextHints: ['matrix', 'strategy', 'node-version', 'os', 'fail-fast', 'include', 'exclude', 'matrix.node-version'],
      completionCriteria: 'Create the matrix test workflow file',
      blocks: [
        {
          kind: 'markdown',
          content: `## Matrix Builds

A **matrix strategy** runs the same job multiple times in parallel with different variable values — perfect for testing across Node.js versions or operating systems without duplicating job definitions.

### Why use matrix for CAP projects?

- Verify your CAP app works on the **Node.js LTS versions** your team supports
- Catch OS-specific path issues (Windows vs Linux) before production
- Each combination runs **in parallel** — no extra wall-clock time

### Basic matrix: multiple Node versions`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `jobs:
  test:
    strategy:
      matrix:
        node-version: [18, 20, 22]
      fail-fast: false   # don't cancel other jobs when one fails

    runs-on: ubuntu-latest
    name: Test on Node \${{ matrix.node-version }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm test`,
        },
        {
          kind: 'markdown',
          content: `### Multi-dimension matrix: Node × OS

Combine two axes to create a grid of combinations. A 3×2 matrix below creates **6 parallel jobs**:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node-version: [18, 20, 22]

    runs-on: \${{ matrix.os }}
    name: Node \${{ matrix.node-version }} / \${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm test`,
        },
        {
          kind: 'markdown',
          content: `### include / exclude — fine-tuning the matrix

Use \`include\` to add extra variables to specific combinations, and \`exclude\` to drop combinations you don't need:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node-version: [18, 20, 22]
    include:
      # Add an extra variable to one specific combination
      - os: ubuntu-latest
        node-version: 20
        run-integration-tests: true
    exclude:
      # Node 18 + Windows is flaky in our suite — skip it
      - os: windows-latest
        node-version: 18`,
        },
        {
          kind: 'markdown',
          content: `### Accessing matrix values in steps

Reference any matrix variable with \`\${{ matrix.<key> }}\`:

\`\`\`yaml
- name: Upload coverage for Node 20 only
  if: matrix.node-version == 20
  uses: codecov/codecov-action@v4
\`\`\`

### fail-fast behaviour

| Setting | Effect |
|---|---|
| \`fail-fast: true\` (default) | As soon as one combination fails, GitHub cancels all still-running jobs in the matrix |
| \`fail-fast: false\` | All combinations run to completion regardless of failures — better for visibility |

For CAP projects, **\`fail-fast: false\`** is usually preferable so you see all failing combinations at once.`,
        },
        {
          kind: 'editor',
          path: '.github/workflows/matrix-test.yml',
          language: 'yaml',
          description: 'Matrix test workflow — runs across multiple Node.js versions',
          defaultContent: `name: Matrix Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    name: Test — Node \${{ matrix.node-version }}
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      matrix:
        node-version: [18, 20, 22]
        include:
          # Run a CDS compile check only on the LTS version
          - node-version: 20
            run-cds-check: true

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install CDS DK (LTS only)
        if: matrix.run-cds-check == true
        run: npm install -g @sap/cds-dk

      - name: CDS compile check
        if: matrix.run-cds-check == true
        run: cds compile db/ srv/ --to edmx

      - name: Run tests
        run: npm test --if-present
`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3: Environments & Approvals
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '04-gha-step-3',
      title: 'Environments & Approvals',
      contextHints: ['environment', 'required reviewers', 'protection rules', 'wait timer', 'deployment branches', 'production gate'],
      completionCriteria: 'Understand how to configure GitHub Environments and add them to a workflow',
      blocks: [
        {
          kind: 'markdown',
          content: `## GitHub Environments & Approval Gates

**GitHub Environments** let you add protection rules to deployments — requiring human approval before a job runs, enforcing which branches can deploy, and creating an audit trail in the GitHub UI.

### Create an environment

Go to **Repository → Settings → Environments → New environment**. Create at least:
- \`dev\` — no protection rules (deploys automatically)
- \`production\` — required reviewers + deployment branch restriction

### Protection rules you can configure

| Rule | Description |
|---|---|
| **Required reviewers** | Up to 6 people/teams must approve before the job runs |
| **Wait timer** | Delay (minutes) after trigger before the job can start — useful for last-minute cancel |
| **Deployment branches** | Only specific branches (e.g. \`main\`) can deploy to this environment |
| **Environment secrets** | Secrets scoped to this environment, revealed only when the job actually runs |

### Using an environment in a workflow job

Add \`environment: <name>\` to any job. GitHub will pause and request approval before executing that job's steps:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `name: Deploy Pipeline

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
      - run: mbt build -t ./mta_archives
      - uses: actions/upload-artifact@v4
        with:
          name: mtar-archive
          path: mta_archives/*.mtar

  deploy-dev:
    needs: build
    runs-on: ubuntu-latest
    environment: dev           # no protection — deploys immediately
    steps:
      - uses: actions/download-artifact@v4
        with: { name: mtar-archive, path: mta_archives/ }
      - run: cf deploy mta_archives/*.mtar

  deploy-production:
    needs: deploy-dev
    runs-on: ubuntu-latest
    environment: production    # ← pauses here, waits for reviewer approval
    steps:
      - uses: actions/download-artifact@v4
        with: { name: mtar-archive, path: mta_archives/ }
      - run: |
          cf login -a \${{ vars.CF_API }} \\
            -u \${{ secrets.CF_USERNAME }} \\
            -p \${{ secrets.CF_PASSWORD }} \\
            -o \${{ secrets.CF_ORG }} \\
            -s \${{ secrets.CF_SPACE_PROD }}
          cf deploy mta_archives/*.mtar --version-rule ALL`,
        },
        {
          kind: 'markdown',
          content: `### What the approval flow looks like

When the \`deploy-production\` job is reached, GitHub:
1. Sends an email/notification to all required reviewers
2. Shows a **Review deployments** button on the workflow run page
3. Blocks execution until at least one reviewer clicks **Approve**
4. Records who approved and when in the deployment history

### Environment variables vs environment secrets

GitHub also supports **environment variables** (not encrypted) defined per-environment — useful for CF API URLs that differ between environments:

\`\`\`yaml
# In the job, reference with vars.<NAME>
- run: cf login -a \${{ vars.CF_API }} ...
\`\`\`

Set these under **Settings → Environments → <name> → Environment variables**.

### Deployment history

Every run with an \`environment:\` key creates an entry under **Repository → Deployments** — giving you a full audit trail of what was deployed, when, by whom, and with what approval.`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4: OIDC — Keyless Auth to BTP
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '04-gha-step-4',
      title: 'OIDC — Keyless Auth to BTP',
      contextHints: ['OIDC', 'id-token: write', 'keyless', 'token exchange', 'trust federation', 'JWT', 'SAP IAS', 'cf oauth-token', 'short-lived token'],
      completionCriteria: 'Understand the OIDC token exchange flow for BTP authentication',
      blocks: [
        {
          kind: 'markdown',
          content: `## OIDC — Keyless Authentication to SAP BTP

### Why OIDC is better than stored credentials

Storing \`CF_USERNAME\` and \`CF_PASSWORD\` as GitHub secrets has several problems:
- Passwords rotate manually — one rotation breaks all pipelines
- A leaked secret is a long-lived credential
- No per-run audit trail — every run uses the same identity

**OIDC (OpenID Connect)** solves this by having GitHub issue a **short-lived JWT token** for each workflow run. Your BTP subaccount is configured to trust GitHub's issuer, so you exchange the JWT for a CF token — no password ever leaves your BTP account.

### The token exchange flow

\`\`\`
GitHub Actions runner
  │
  │  1. Request OIDC token
  │     (audience: SAP BTP IAS / CF)
  ▼
GitHub OIDC endpoint
  │
  │  2. Returns signed JWT
  │     (iss: token.actions.githubusercontent.com,
  │      sub: repo:owner/repo:environment:prod,
  │      exp: +5 minutes)
  ▼
SAP BTP Trust Configuration
  │
  │  3. Exchange JWT for CF token
  │     (POST /oauth/token)
  ▼
Cloud Foundry API
  │
  │  4. CF token accepted
  ▼
cf deploy ✓
\`\`\`

### Step 1 — Configure trust in BTP

In **BTP Cockpit → Subaccount → Security → Trust Configuration**:
1. Add a new trusted identity provider
2. Provider: \`https://token.actions.githubusercontent.com\`
3. Map the \`sub\` claim to the CF user/role you want to grant

This is a one-time setup per subaccount.

### Step 2 — Workflow configuration`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `name: Deploy with OIDC

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  id-token: write   # ← required for OIDC token request

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Download MTAR artifact
        uses: actions/download-artifact@v4
        with:
          name: mtar-archive
          path: mta_archives/

      - name: Install CF CLI
        run: |
          curl -fsSL "https://packages.cloudfoundry.org/stable?release=linux64-binary&version=v8&source=github" | tar -zx
          sudo mv cf8 /usr/local/bin/cf

      # Step A — Request OIDC token from GitHub
      - name: Get GitHub OIDC token
        id: oidc
        run: |
          OIDC_TOKEN=\$(curl -sSfL -H "Authorization: bearer \$ACTIONS_ID_TOKEN_REQUEST_TOKEN" \\
            "\$ACTIONS_ID_TOKEN_REQUEST_URL&audience=\${{ vars.CF_API }}" \\
            | jq -r '.value')
          echo "token=\$OIDC_TOKEN" >> \$GITHUB_OUTPUT

      # Step B — Exchange OIDC token for CF OAuth token
      - name: Exchange OIDC token for CF token
        id: cf-token
        env:
          CF_API: \${{ vars.CF_API }}
          OIDC_TOKEN: \${{ steps.oidc.outputs.token }}
          UAA_URL: \${{ vars.UAA_URL }}   # e.g. https://your-subaccount.authentication.us10.hana.ondemand.com
        run: |
          CF_TOKEN=\$(curl -sSf -X POST "\$UAA_URL/oauth/token" \\
            -H "Content-Type: application/x-www-form-urlencoded" \\
            -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \\
            -d "assertion=\$OIDC_TOKEN" \\
            -d "client_id=cf" \\
            -d "client_secret=" \\
            -d "response_type=token" \\
            | jq -r '.access_token')
          echo "::add-mask::\$CF_TOKEN"
          echo "token=\$CF_TOKEN" >> \$GITHUB_OUTPUT

      # Step C — Use the CF token directly
      - name: CF Login with token
        run: |
          cf api \${{ vars.CF_API }}
          cf oauth-token   # verify token exchange
          cf target -o \${{ vars.CF_ORG }} -s \${{ vars.CF_SPACE_PROD }}

      - name: Deploy
        run: cf deploy mta_archives/*.mtar --version-rule ALL

      - name: CF Logout
        if: always()
        run: cf logout`,
        },
        {
          kind: 'markdown',
          content: `### Variables to configure (no secrets needed!)

| Variable (non-secret) | Example value |
|---|---|
| \`vars.CF_API\` | \`https://api.cf.us10.hana.ondemand.com\` |
| \`vars.UAA_URL\` | \`https://mysubaccount.authentication.us10.hana.ondemand.com\` |
| \`vars.CF_ORG\` | \`my-org\` |
| \`vars.CF_SPACE_PROD\` | \`production\` |

With OIDC, you store **zero passwords** in GitHub. Each token expires within minutes of the run.

### Subject claim filtering

You can restrict which workflows can exchange for a CF token by filtering the \`sub\` claim in your BTP trust configuration:

\`\`\`
repo:myorg/myrepo:environment:production
repo:myorg/myrepo:ref:refs/heads/main
\`\`\`

This means only runs triggered from the \`production\` environment or the \`main\` branch can authenticate.`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 5: PR Validation Workflow
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '04-gha-step-5',
      title: 'PR Validation Workflow',
      contextHints: ['pull_request', 'pr-check', 'npm ci', 'cds compile', 'npm test', 'lint', 'status check', 'branch protection'],
      completionCriteria: 'Create the PR check workflow file',
      blocks: [
        {
          kind: 'markdown',
          content: `## PR Validation Workflow

A dedicated PR check workflow acts as a **quality gate** — it runs on every pull request and blocks the merge if anything fails. This catches broken CDS schemas, failing tests, or compile errors before they reach \`main\`.

### What to check on every PR

| Check | Command | Why |
|---|---|---|
| Install deps | \`npm ci\` | Verify \`package-lock.json\` is consistent |
| CDS compile | \`cds compile db/ srv/ --to edmx\` | Catch schema errors early |
| Unit tests | \`npm test\` | Prevent regressions |
| Lint | \`npm run lint\` | Enforce code style |

### Making the check required

After creating this workflow, go to **Settings → Branches → Branch protection rules** for \`main\` and add the job name as a **required status check**. GitHub will then block the merge button until the check passes.`,
        },
        {
          kind: 'editor',
          path: '.github/workflows/pr-check.yml',
          language: 'yaml',
          description: 'PR validation: install, CDS compile check, lint, test',
          defaultContent: `name: PR Check

on:
  pull_request:
    branches: [ main, develop ]
    # Only run when these paths change — skip doc-only PRs
    paths:
      - 'db/**'
      - 'srv/**'
      - 'app/**'
      - 'package*.json'
      - 'mta.yaml'
      - '.github/workflows/**'

jobs:
  validate:
    name: Validate PR
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

      - name: Install CDS DK
        run: npm install -g @sap/cds-dk

      # Compile CDS schema to OData EDMX — fails on schema errors
      - name: CDS compile check
        run: cds compile db/ srv/ --to edmx --log-level warn

      # Optional: validate mta.yaml is well-formed
      - name: Validate mta.yaml
        run: |
          if [ -f mta.yaml ]; then
            node -e "require('js-yaml').load(require('fs').readFileSync('mta.yaml','utf8')); console.log('mta.yaml OK')" \\
              || (echo "mta.yaml parse error" && exit 1)
          fi

      - name: Lint
        run: npm run lint --if-present

      - name: Run tests
        run: npm test --if-present

      - name: Build check (dry run)
        run: cds build --production
`,
        },
        {
          kind: 'markdown',
          content: `### PR check tips

**\`paths:\` filter** — the workflow only triggers when relevant files change. A PR that only touches \`README.md\` won't consume runner minutes.

**\`--if-present\` flag** — \`npm test --if-present\` and \`npm run lint --if-present\` skip gracefully if the script isn't defined in \`package.json\`, so the workflow works even on projects without a test suite yet.

**CDS compile check** — \`cds compile db/ srv/ --to edmx\` is the fastest way to validate your data model and service definitions. It fails immediately if:
- An entity refers to an undefined type
- A navigation property target doesn't exist
- An annotation value has an incorrect type

**Status check names** match the job name in the YAML (\`validate\` here). Use that exact string in branch protection settings.`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 6: Caching Dependencies
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '04-gha-step-6',
      title: 'Caching Dependencies',
      contextHints: ['actions/cache', 'cache', 'node_modules', 'package-lock.json', 'cache-hit', 'hashFiles', 'npm ci', 'cache key'],
      completionCriteria: 'Understand the cache step pattern and how to key it correctly',
      blocks: [
        {
          kind: 'markdown',
          content: `## Caching Dependencies

Without caching, every workflow run reinstalls all npm packages from scratch. For a typical CAP project with \`@sap/cds\`, this takes **60–120 seconds**. With caching, subsequent runs restore the cache in **5–10 seconds**.

### How \`actions/cache\` works

1. **Key** — a hash computed from your lockfile. If it matches a stored cache, that cache is restored.
2. **Restore keys** — fallback patterns for partial cache hits (e.g. a different minor version).
3. **Post-run save** — if no exact cache hit was found, the cache is saved at the end of the run.

### Cache key strategy

The key \`\${{ runner.os }}-npm-\${{ hashFiles('**/package-lock.json') }}\` means:
- Different OS → different cache (Linux vs Windows node_modules aren't compatible)
- Any change to \`package-lock.json\` → new cache entry`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `steps:
  - uses: actions/checkout@v4

  - uses: actions/setup-node@v4
    with:
      node-version: '20'
      # The built-in cache option in setup-node is the simplest approach:
      cache: 'npm'   # equivalent to the manual steps below — prefer this

  - run: npm ci`,
        },
        {
          kind: 'markdown',
          content: `The \`cache: 'npm'\` shorthand in \`actions/setup-node\` handles everything. For more control (e.g. caching a monorepo or a custom directory), use the explicit \`actions/cache\` step:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `steps:
  - uses: actions/checkout@v4

  - uses: actions/setup-node@v4
    with:
      node-version: '20'

  # Manual cache step — full control over path and key
  - name: Cache node_modules
    id: cache-npm
    uses: actions/cache@v4
    with:
      path: |
        node_modules
        ~/.npm
      key: \${{ runner.os }}-npm-\${{ hashFiles('**/package-lock.json') }}
      restore-keys: |
        \${{ runner.os }}-npm-

  # Only run install if cache was NOT hit
  - name: Install dependencies
    if: steps.cache-npm.outputs.cache-hit != 'true'
    run: npm ci

  # Even on cache hit, run install in case of a partial restore
  # (npm ci is idempotent and fast when node_modules is already there)
  - name: Verify installation
    run: npm ls --depth=0 2>/dev/null || npm ci`,
        },
        {
          kind: 'markdown',
          content: `### Caching the global MBT and CDS tools

For workflows that install \`mbt\` and \`@sap/cds-dk\` globally, cache the npm global prefix too:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `- name: Cache global npm tools
  uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      /usr/local/lib/node_modules/mbt
      /usr/local/lib/node_modules/@sap
    key: \${{ runner.os }}-global-tools-mbt-cds-\${{ hashFiles('package.json') }}
    restore-keys: |
      \${{ runner.os }}-global-tools-mbt-cds-

- name: Install global tools (if not cached)
  run: |
    mbt --version 2>/dev/null || npm install -g mbt
    cds --version 2>/dev/null || npm install -g @sap/cds-dk`,
        },
        {
          kind: 'markdown',
          content: `### Cache size limits and eviction

- GitHub Actions caches are **limited to 10 GB per repository**
- Caches older than **7 days** are evicted automatically
- The most recently accessed cache is kept longest

### Typical time savings

| Operation | Without cache | With cache |
|---|---|---|
| \`npm ci\` (50 packages) | 30–60 s | 5–10 s |
| \`npm ci\` (200+ packages with @sap) | 90–120 s | 8–15 s |
| \`npm install -g mbt @sap/cds-dk\` | 60–90 s | 5–8 s |`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 7: Custom Composite Actions
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '04-gha-step-7',
      title: 'Custom Composite Actions',
      contextHints: ['composite action', 'action.yml', 'runs: using: composite', 'steps:', 'inputs', 'outputs', 'local action', '.github/actions'],
      completionCriteria: 'Create the composite action file for CAP deploy',
      blocks: [
        {
          kind: 'markdown',
          content: `## Custom Composite Actions

When the same sequence of steps appears in multiple workflows, extract it into a **composite action**. A composite action is a reusable, parameterised unit that lives in your repo.

### Three types of custom actions

| Type | Language | Use when |
|---|---|---|
| **Composite** | YAML (shell steps) | Wrapping existing CLI tools — easiest to write |
| **JavaScript** | Node.js | Need full scripting, GitHub API access, complex logic |
| **Docker** | Any language | Need a specific environment, tools, or OS packages |

For CAP/BTP workflows, **composite actions** cover 95% of use cases.

### Composite action anatomy

A composite action lives at \`.github/actions/<name>/action.yml\` (or in a separate repo). It defines \`inputs\`, \`outputs\`, and a list of \`steps\` — exactly like a job, but reusable.`,
        },
        {
          kind: 'code',
          language: 'yaml',
          filename: '.github/actions/deploy-cap/action.yml',
          content: `name: Deploy CAP to BTP CF
description: |
  Installs CF CLI, logs in, and deploys an MTAR archive to SAP BTP Cloud Foundry.
  Expects the .mtar file to already exist in the path specified by mtar-path.

inputs:
  mtar-path:
    description: 'Glob path to the .mtar file (e.g. mta_archives/*.mtar)'
    required: true
    default: 'mta_archives/*.mtar'
  cf-api:
    description: 'Cloud Foundry API endpoint'
    required: true
  cf-org:
    description: 'CF organisation name'
    required: true
  cf-space:
    description: 'CF space name'
    required: true
  cf-username:
    description: 'CF technical user email'
    required: true
  cf-password:
    description: 'CF technical user password'
    required: true

outputs:
  deployed-app-url:
    description: 'URL of the deployed srv application'
    value: \${{ steps.get-url.outputs.url }}

runs:
  using: composite
  steps:
    - name: Install CF CLI
      shell: bash
      run: |
        if ! command -v cf &> /dev/null; then
          echo "Installing CF CLI..."
          curl -fsSL "https://packages.cloudfoundry.org/stable?release=linux64-binary&version=v8&source=github" | tar -zx
          sudo mv cf8 /usr/local/bin/cf
        fi
        cf version

    - name: CF Login
      shell: bash
      run: |
        cf login \\
          -a \${{ inputs.cf-api }} \\
          -u \${{ inputs.cf-username }} \\
          -p \${{ inputs.cf-password }} \\
          -o \${{ inputs.cf-org }} \\
          -s \${{ inputs.cf-space }}

    - name: Deploy MTAR
      shell: bash
      run: cf deploy \${{ inputs.mtar-path }} --version-rule ALL

    - name: Get deployed app URL
      id: get-url
      shell: bash
      run: |
        APP_NAME=\$(cf apps | grep started | head -1 | awk '{print \$1}')
        if [ -n "\$APP_NAME" ]; then
          URL=\$(cf app "\$APP_NAME" | grep routes | awk '{print \$2}')
          echo "url=https://\$URL" >> \$GITHUB_OUTPUT
        fi

    - name: CF Logout
      if: always()
      shell: bash
      run: cf logout`,
        },
        {
          kind: 'markdown',
          content: `### Using the composite action in a workflow

Reference the local action with \`uses: ./.github/actions/deploy-cap\`:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download MTAR
        uses: actions/download-artifact@v4
        with:
          name: mtar-archive
          path: mta_archives/

      # Use the composite action — inputs map to action.yml inputs
      - name: Deploy to BTP
        id: deploy
        uses: ./.github/actions/deploy-cap
        with:
          mtar-path: 'mta_archives/*.mtar'
          cf-api: \${{ vars.CF_API }}
          cf-org: \${{ secrets.CF_ORG }}
          cf-space: \${{ secrets.CF_SPACE_DEV }}
          cf-username: \${{ secrets.CF_USERNAME }}
          cf-password: \${{ secrets.CF_PASSWORD }}

      - name: Print deployed URL
        run: echo "App deployed at \${{ steps.deploy.outputs.deployed-app-url }}"`,
        },
        {
          kind: 'markdown',
          content: `### Key rules for composite actions

- Every step must declare \`shell: bash\` (or \`pwsh\`, etc.) — it's not inherited from the caller job
- Use \`\${{ inputs.<name> }}\` to access inputs inside steps
- Write outputs using \`echo "key=value" >> \$GITHUB_OUTPUT\` in the step, then reference with \`value: \${{ steps.<id>.outputs.<key> }}\` in the \`outputs:\` section
- The action runs in the **caller's workspace** — file paths are relative to the repo root`,
        },
        {
          kind: 'editor',
          path: '.github/actions/deploy-cap/action.yml',
          language: 'yaml',
          description: 'Composite action: installs CF CLI, logs in, deploys MTAR, returns app URL',
          defaultContent: `name: Deploy CAP to BTP CF
description: |
  Installs CF CLI, logs in, and deploys an MTAR archive to SAP BTP Cloud Foundry.
  Expects the .mtar file to already exist in the path specified by mtar-path.

inputs:
  mtar-path:
    description: 'Glob path to the .mtar file'
    required: true
    default: 'mta_archives/*.mtar'
  cf-api:
    description: 'Cloud Foundry API endpoint'
    required: true
  cf-org:
    description: 'CF organisation name'
    required: true
  cf-space:
    description: 'CF space name'
    required: true
  cf-username:
    description: 'CF technical user email'
    required: true
  cf-password:
    description: 'CF technical user password'
    required: true

outputs:
  deployed-app-url:
    description: 'URL of the deployed srv application'
    value: \${{ steps.get-url.outputs.url }}

runs:
  using: composite
  steps:
    - name: Install CF CLI
      shell: bash
      run: |
        if ! command -v cf &> /dev/null; then
          curl -fsSL "https://packages.cloudfoundry.org/stable?release=linux64-binary&version=v8&source=github" | tar -zx
          sudo mv cf8 /usr/local/bin/cf
        fi
        cf version

    - name: CF Login
      shell: bash
      run: |
        cf login \\
          -a \${{ inputs.cf-api }} \\
          -u \${{ inputs.cf-username }} \\
          -p \${{ inputs.cf-password }} \\
          -o \${{ inputs.cf-org }} \\
          -s \${{ inputs.cf-space }}

    - name: Deploy MTAR
      shell: bash
      run: cf deploy \${{ inputs.mtar-path }} --version-rule ALL

    - name: Get deployed app URL
      id: get-url
      shell: bash
      run: |
        APP_NAME=\$(cf apps | grep started | head -1 | awk '{print \$1}')
        if [ -n "\$APP_NAME" ]; then
          URL=\$(cf app "\$APP_NAME" | grep routes | awk '{print \$2}')
          echo "url=https://\$URL" >> \$GITHUB_OUTPUT
        fi

    - name: CF Logout
      if: always()
      shell: bash
      run: cf logout
`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 8: Debugging Failed Runs
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '04-gha-step-8',
      title: 'Debugging Failed Runs',
      contextHints: ['ACTIONS_STEP_DEBUG', 'debug logs', 'gh run list', 'gh run view', 'tmate', 'SSH debug', 're-run', 'workflow logs', 'BTP deploy failure'],
      completionCriteria: 'Know how to enable debug logs, use gh CLI, and apply tmate for interactive debugging',
      blocks: [
        {
          kind: 'markdown',
          content: `## Debugging Failed Workflow Runs

When a workflow fails, GitHub Actions gives you several escalating tools to investigate.

---

### Level 1 — Read the logs in the GitHub UI

Click the failing job → expand the failing step. The most important signals:
- **Exit code** — non-zero exit codes fail the step
- **STDERR vs STDOUT** — GitHub captures both; STDERR is shown in red
- **Truncated output** — very long steps may be cut off; download the full log with the button in the top-right of the logs panel

---

### Level 2 — Enable debug logging

Add a repository secret named \`ACTIONS_STEP_DEBUG\` with value \`true\`. On the next run, every step will emit verbose internal debug output — including what GitHub Actions itself does behind the scenes (download artifacts, cache operations, environment setup).

You can also enable just the **runner diagnostics** (which machine, timing, network) with a separate secret:

| Secret | Value | Effect |
|---|---|---|
| \`ACTIONS_STEP_DEBUG\` | \`true\` | Verbose step-level debug output |
| \`ACTIONS_RUNNER_DEBUG\` | \`true\` | Runner infrastructure diagnostics |

These secrets are honoured even without changing any workflow YAML — no commit needed.

---

### Level 3 — Re-run with debug logs

In the GitHub UI, click **Re-run jobs → Re-run failed jobs → Enable debug logging** checkbox. This is equivalent to setting the secrets above for a single run only.

---

### Level 4 — \`gh\` CLI for log inspection`,
        },
        {
          kind: 'code',
          language: 'bash',
          content: `# List recent runs for the current repo
gh run list

# List runs for a specific workflow file
gh run list --workflow deploy.yml

# Watch a running workflow live
gh run watch

# View logs for a specific run (get the ID from gh run list)
gh run view 12345678 --log

# View logs for just the failed steps
gh run view 12345678 --log-failed

# Download full log archive as a zip
gh run download 12345678 --dir ./run-logs

# Re-run only failed jobs (no need to re-run the whole workflow)
gh run rerun 12345678 --failed

# Re-run with debug logging enabled
gh run rerun 12345678 --failed --debug`,
        },
        {
          kind: 'markdown',
          content: `---

### Level 5 — SSH into the runner with tmate

When you need to interactively inspect the runner filesystem, environment variables, or run commands manually, add the \`tmate\` action to pause the workflow and give you an SSH session:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `- name: Setup tmate session (DEBUG — remove before merging!)
  uses: mxschmitt/action-tmate@v3
  if: failure()   # only start SSH session when a previous step failed
  with:
    limit-access-to-actor: true   # only your GitHub user can connect`,
        },
        {
          kind: 'markdown',
          content: `When the tmate step runs, it prints an SSH connection string in the logs. Connect from your terminal, poke around the filesystem, inspect environment variables, run CF commands manually. The session stays open until you type \`continue\` in the SSH shell or the job times out.

> **Remove tmate steps before merging to main** — they pause the workflow indefinitely and consume runner minutes.

---

### Common BTP deployment failure patterns

| Symptom | Likely cause | Fix |
|---|---|---|
| \`CF-UnknownError\` during \`cf deploy\` | Outdated \`mtar\` archive format | Upgrade \`mbt\` to latest version |
| \`quota exceeded\` | Space has no free memory/instances | Scale down or request quota increase |
| \`App failed to start\` | Wrong Node.js version in buildpack or missing env var | Check \`cf logs <app> --recent\` |
| \`Service broker error: already exists\` | Service instance name collision across spaces | Use space-specific service names in \`mta.yaml\` |
| \`login failed\` in Actions | Expired or wrong credentials | Rotate \`CF_PASSWORD\` secret; check for whitespace in secret value |
| \`ENOTFOUND api.cf.us10.hana.ondemand.com\` | Wrong CF API URL | Verify region in BTP Cockpit |
| HANA HDI deploy hangs | Schema migration lock from failed prior run | Run \`cf undeploy <app> --delete-services\` and re-deploy (destructive!) |

---

### Reading CF logs from GitHub Actions

Add a post-deploy step that captures recent CF logs for any failed app:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          content: `- name: Dump CF logs on failure
  if: failure()
  run: |
    echo "=== cf apps ==="
    cf apps || true
    echo ""
    echo "=== Recent logs ==="
    # Get the srv app name dynamically
    SRV_APP=\$(cf apps 2>/dev/null | grep -v "^Getting\\|^name\\|^---\\|^OK" | awk '{print \$1}' | grep -v "^$" | head -1)
    if [ -n "\$SRV_APP" ]; then
      echo "Logs for \$SRV_APP:"
      cf logs "\$SRV_APP" --recent 2>&1 | tail -100
    fi
    echo ""
    echo "=== cf events ==="
    cf events "\$SRV_APP" 2>/dev/null | tail -20 || true`,
        },
        {
          kind: 'markdown',
          content: `### Workflow-level debug output with \`::debug::\`

You can emit custom debug lines from any \`run:\` step that only appear when debug logging is enabled:

\`\`\`bash
echo "::debug::CF_API is set to: \$CF_API"
echo "::debug::mtar file size: \$(du -sh mta_archives/*.mtar)"
\`\`\`

This keeps your normal log output clean while giving rich detail during debugging sessions.`,
        },
      ],
    },
  ],
}
