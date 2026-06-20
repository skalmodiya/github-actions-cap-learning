import type { Module } from '../types'

export const monitoringModule: Module = {
  id: '06-monitoring',
  title: 'Monitoring & Troubleshooting',
  icon: '📊',
  description: 'Monitor your CAP app on BTP, read logs, diagnose crashes, and fix common deployment failures',
  steps: [
    // ─────────────────────────────────────────────────────────────────
    // Step 1: CF Application Logs
    // ─────────────────────────────────────────────────────────────────
    {
      id: '06-monitoring-step-1',
      title: 'CF Application Logs',
      contextHints: ['cf logs', 'cf logs --recent', 'APP/0', 'RTR/0', 'STG/0', 'log format', 'streaming logs'],
      completionCriteria: 'Run cf logs --recent for your app and identify at least one log source type',
      blocks: [
        {
          kind: 'markdown',
          content: `## CF Application Logs

Cloud Foundry gives you two ways to read your application logs.

### \`cf logs --recent\` vs \`cf logs\` (live)

| Command | What it does | Best for |
|---|---|---|
| \`cf logs <app> --recent\` | Dumps the last ~200 buffered lines and exits | Startup failures, crash analysis |
| \`cf logs <app>\` | Streams new log lines in real-time | Watching a deploy in progress, live traffic |

Use **\`--recent\` first** when debugging a crash — it shows what happened before the app died.
Use **live streaming** when you are actively sending requests or watching a deployment.

---

### Log Format

Every CF log line follows this pattern:

\`\`\`
2024-03-15T10:23:45.12+0000 [APP/PROC/WEB/0] OUT Server is listening on port 4004
│                             │                │   │
│                             │                │   └─ log message
│                             │                └─ OUT = stdout  ERR = stderr
│                             └─ source component / instance index
└─ UTC timestamp
\`\`\`

### CF Log Sources

| Source | Meaning |
|---|---|
| \`APP/PROC/WEB/0\` | Your application code, instance 0 |
| \`APP/PROC/WEB/1\` | Your application code, instance 1 (if scaled) |
| \`RTR/0\` | Router — HTTP request/response lines (access log) |
| \`API/0\` | CF API events — app started, stopped, crashed |
| \`STG/0\` | Staging (build) output — appears during \`cf push\` or \`cf deploy\` |
| \`CELL/0\` | Diego cell — container lifecycle events |

### What to look for

- \`ERR\` lines from \`APP/\` — unhandled exceptions, missing modules
- \`[API/0] ... app crashed\` — crash loop confirmation
- \`[RTR/0] ... 502\` — gateway errors (app not responding)
- \`[STG/0] ... npm ERR!\` — build failures during staging

---

> ✏ **Replace \`my-bookshop-srv\` below with your actual CF app name.**
> Find it with \`cf apps\` if you are not sure.`,
        },
        {
          kind: 'run',
          label: 'Show recent logs (last ~200 lines) — exits immediately',
          command: 'cf logs my-bookshop-srv --recent',
        },
        {
          kind: 'markdown',
          content: `The command above exits on its own after printing buffered lines — perfect for startup failures.

Now try the **live stream**. It runs indefinitely — click **Stop** when you are done watching.`,
        },
        {
          kind: 'run',
          label: 'Stream live logs — click Stop when done',
          command: 'cf logs my-bookshop-srv',
        },
        {
          kind: 'markdown',
          content: `### Filtering tips

Pipe \`--recent\` output through grep to focus on errors:

\`\`\`bash
cf logs my-bookshop-srv --recent | grep -i "err\\|exception\\|failed\\|cannot"
\`\`\`

On Windows PowerShell:
\`\`\`powershell
cf logs my-bookshop-srv --recent | Select-String "err|exception|failed|cannot"
\`\`\``,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────
    // Step 2: CF Events & Crash Analysis
    // ─────────────────────────────────────────────────────────────────
    {
      id: '06-monitoring-step-2',
      title: 'CF Events & Crash Analysis',
      contextHints: ['cf events', 'cf app', 'crash', 'OOM', 'memory', 'startup timeout', 'exit code', 'instance'],
      completionCriteria: 'Run cf events and cf app for your service and read the output',
      blocks: [
        {
          kind: 'markdown',
          content: `## CF Events & Crash Analysis

### \`cf events\` — the deployment history

\`cf events <app>\` shows a reverse-chronological list of significant events: deployments, crashes, scaling operations, env var changes.

\`\`\`
time                          event                      actor   description
2024-03-15T10:20:00.00+0000   app.crash                  web     index: 0, reason: CRASHED, exit_status: 1
2024-03-15T10:19:55.00+0000   audit.app.process.crash    web     index: 0, reason: CRASHED
2024-03-15T10:15:00.00+0000   audit.app.update           admin   state: STARTED
\`\`\`

Look for **\`app.crash\`** events and note the \`exit_status\`:

| Exit Status | Meaning |
|---|---|
| \`1\` | App crashed with an unhandled error (check APP logs) |
| \`2\` | App was killed by CF (OOM or timeout) |
| \`137\` | Container killed — almost always Out of Memory |
| \`143\` | SIGTERM — app was stopped gracefully (not a bug) |

---

### \`cf app\` — current state at a glance

\`cf app <app>\` shows memory/disk usage, instance count, and the current health status without opening the BTP cockpit.

\`\`\`
name:              my-bookshop-srv
requested state:   started
instances:         1/1
usage:             256M x 1 instances
urls:              my-bookshop-srv.cfapps.eu10.hana.ondemand.com
last uploaded:     Fri 15 Mar 10:15:00 UTC 2024
stack:             cflinuxfs3

     state     since       cpu    memory          disk
#0   running   10:15:10    0.3%   180M of 256M    120M of 1G
\`\`\`

If the **state** is \`crashed\` or \`down\`, jump straight to \`cf logs --recent\`.

---

> ✏ **Replace \`my-bookshop-srv\` below with your actual CF app name.**`,
        },
        {
          kind: 'run',
          label: 'Show recent events (crashes, deploys, scale events)',
          command: 'cf events my-bookshop-srv',
        },
        {
          kind: 'run',
          label: 'Show app state, instances, memory and disk usage',
          command: 'cf app my-bookshop-srv',
        },
        {
          kind: 'markdown',
          content: `### Common crash reasons and fixes

| Symptom | Root cause | Fix |
|---|---|---|
| Exit status 137, state \`crashed\` | Out of Memory — app exceeds its memory quota | Increase memory: \`cf scale my-bookshop-srv -m 512M\` |
| State \`down\`, never reaches \`running\` | Startup timeout — app takes too long to bind port | Increase health check grace period in \`manifest.yml\`: \`health-check-invocation-timeout: 60\` |
| Exit status 1 immediately after start | Unhandled exception at startup — missing env var or module | Check \`cf logs my-bookshop-srv --recent\` for the stack trace |
| Repeated crash loop | App crashes, CF restarts it, crash again | Fix the root cause; use \`cf stop my-bookshop-srv\` first to stop the loop |
| \`502 Bad Gateway\` in RTR logs | App is not listening on the PORT env var | Ensure your server binds \`process.env.PORT\` not a hard-coded port |`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────
    // Step 3: CF Services Status
    // ─────────────────────────────────────────────────────────────────
    {
      id: '06-monitoring-step-3',
      title: 'CF Services Status',
      contextHints: ['cf services', 'cf service', 'cf env', 'VCAP_SERVICES', 'service binding', 'HDI', 'XSUAA', 'credentials'],
      completionCriteria: 'List your services and inspect the env of your CAP service app',
      blocks: [
        {
          kind: 'markdown',
          content: `## CF Services Status

Many CAP deployment failures are actually **service problems** — a binding is missing, a service is in an error state, or the credentials look wrong.

### \`cf services\` — your full service inventory

Lists every service instance in the current CF space with its plan and bound apps.

\`\`\`
name                  service      plan          bound apps          last operation
my-bookshop-db        hana         hdi-shared    my-bookshop-srv     create succeeded
my-bookshop-auth      xsuaa        application   my-bookshop-srv     create succeeded
my-bookshop-dest      destination  lite          my-bookshop-srv     create succeeded
\`\`\`

Watch the **last operation** column — \`create in progress\` means the service is not ready yet.
A status of \`create failed\` means provisioning failed and you need to investigate in the BTP cockpit.

---

### \`cf service <name>\` — details for one service

Shows the full status, dashboard URL, and recent operations for a specific service instance.

---

### \`cf env <app>\` — what the app actually sees

This is the most useful command for debugging binding issues. It shows the full environment the running app receives, including the decoded \`VCAP_SERVICES\` JSON.

---

> ✏ **Replace the service and app names below with your own.**`,
        },
        {
          kind: 'run',
          label: 'List all service instances in the current space',
          command: 'cf services',
        },
        {
          kind: 'run',
          label: 'Show details and status of one service instance',
          command: 'cf service my-bookshop-db',
        },
        {
          kind: 'run',
          label: 'Show all environment variables bound to the app',
          command: 'cf env my-bookshop-srv',
        },
        {
          kind: 'markdown',
          content: `### Reading VCAP_SERVICES

When a service is bound, CF injects its credentials into the app's environment under \`VCAP_SERVICES\`. Your CAP app reads this automatically via \`@sap/xsenv\`.

\`\`\`json
{
  "hana": [
    {
      "binding_name": null,
      "instance_name": "my-bookshop-db",
      "name": "my-bookshop-db",
      "credentials": {
        "host": "xyz.hana.ondemand.com",
        "port": "443",
        "driver": "com.sap.db.jdbc.Driver",
        "url": "jdbc:sap://xyz...",
        "schema": "MY_SCHEMA_GUID",
        "user": "MY_USER",
        "password": "••••••"
      },
      "tags": ["hana", "database", "relational"]
    }
  ]
}
\`\`\`

### Common service binding problems

| Symptom | Cause | Fix |
|---|---|---|
| \`VCAP_SERVICES\` missing a service | Binding was not created or failed | Run \`cf bind-service my-bookshop-srv my-bookshop-db\` then restage |
| Service shows \`create failed\` | Provisioning error (quota, config) | Delete and recreate: \`cf delete-service my-bookshop-db\` |
| Credentials are present but app says "DB not reachable" | Wrong IP allowlist or firewall on HANA | Check SAP HANA Cloud instance connections in BTP cockpit |
| \`xsenv: no services found for ...tag...\` | Service tag mismatch | Confirm tags in \`cf service <name>\` match what \`@sap/xsenv\` expects |`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────
    // Step 4: GitHub Actions Run Logs via gh CLI
    // ─────────────────────────────────────────────────────────────────
    {
      id: '06-monitoring-step-4',
      title: 'GitHub Actions Logs via gh CLI',
      contextHints: ['gh run list', 'gh run view', 'gh run rerun', 'gh CLI', 'workflow runs', 'failed steps', 'GitHub Actions logs'],
      completionCriteria: 'List your recent workflow runs and view the log of the most recent one',
      blocks: [
        {
          kind: 'markdown',
          content: `## GitHub Actions Run Logs via \`gh\` CLI

The \`gh\` CLI lets you inspect workflow runs, read logs, and rerun failures **without leaving the terminal** — much faster than opening the browser.

### Prerequisites

Install the GitHub CLI: [cli.github.com](https://cli.github.com) then authenticate once:

\`\`\`bash
gh auth login
\`\`\`

---

### \`gh run list\` — see recent runs

Shows the run ID, workflow name, branch, status, and duration. The run ID is what you use in all other \`gh run\` commands.

\`\`\`
STATUS  TITLE             WORKFLOW     BRANCH  EVENT  ID          ELAPSED  AGE
✓       chore: add tests  deploy.yml   main    push   8456123456  2m34s    2h
✗       fix: null check   deploy.yml   main    push   8456100001  1m02s    3h
✓       feat: add orders  deploy.yml   main    push   8455987654  3m11s    5h
\`\`\`

---

> ✏ **The commands below work in any repository where you have run \`gh auth login\`.**
> If you are not inside a git repo with a GitHub remote, add \`--repo owner/name\` to each command.`,
        },
        {
          kind: 'run',
          label: 'List the 10 most recent workflow runs',
          command: 'gh run list --limit 10',
        },
        {
          kind: 'run',
          label: 'Filter runs to a specific workflow file',
          command: 'gh run list --workflow deploy.yml --limit 5',
        },
        {
          kind: 'markdown',
          content: `### \`gh run view\` — details of a run

Without a run ID, \`gh run view\` shows an interactive picker for the most recent runs.
With a run ID, it shows that specific run directly.`,
        },
        {
          kind: 'run',
          label: 'View the most recent run (interactive picker)',
          command: 'gh run view',
        },
        {
          kind: 'run',
          label: 'Show only the logs from failed steps (fastest way to find the error)',
          command: 'gh run view --log-failed',
        },
        {
          kind: 'markdown',
          content: `### Re-running failed workflows

Once you have fixed the issue and pushed, or if you want to retry a transient failure:

\`\`\`bash
# Re-run only the failed jobs (cheaper, faster)
gh run rerun <run-id> --failed-only

# Re-run the entire workflow
gh run rerun <run-id>
\`\`\`

Replace \`<run-id>\` with the numeric ID from \`gh run list\`.

### Watch a run in progress

\`\`\`bash
gh run watch <run-id>
\`\`\`

This streams status updates live — useful right after pushing to confirm the deploy is proceeding.

### Download full logs as a zip

\`\`\`bash
gh run download <run-id>
\`\`\`

Saves all step logs to a local directory for offline analysis.`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────
    // Step 5: Common BTP Deployment Failure Patterns
    // ─────────────────────────────────────────────────────────────────
    {
      id: '06-monitoring-step-5',
      title: 'Common BTP Deployment Failure Patterns',
      contextHints: ['EADDRINUSE', 'HDI container', 'mtar size', 'node_modules', '.cfignore', 'token expired', 'manifest.yml', 'cds compile', '500 Internal Server Error', 'BTP status'],
      completionCriteria: 'Review the error table and code examples for your most likely failure scenario',
      blocks: [
        {
          kind: 'markdown',
          content: `## Common BTP Deployment Failure Patterns

This reference covers the errors you are most likely to encounter when deploying CAP apps to BTP Cloud Foundry.

### Error quick-reference table

| Error message | Root cause | Fix |
|---|---|---|
| \`EADDRINUSE :::4004\` | Another \`cds watch\` process is still running on that port | \`kill $(lsof -ti:4004)\` on Mac/Linux; on Windows: \`netstat -ano | findstr 4004\` then \`taskkill /PID <pid> /F\` |
| \`HDI container creation failed\` | HDI quota exceeded in the subaccount, or wrong service plan selected | Check BTP cockpit → Services → Instances. Increase quota or delete unused HDI containers. |
| \`mtar size exceeds the maximum allowed size\` | \`node_modules\` or other large directories included in the \`.mtar\` archive | Add a \`.cfignore\` file (see below) |
| \`Cannot read properties of undefined (reading 'db')\` | The \`db\` service binding is missing at runtime | Check \`mta.yaml\` \`requires\` section and \`cf env\` to confirm binding exists |
| \`Error: Token expired\` during \`cf deploy\` | Your CF session timed out mid-deployment (long build) | Run \`cf login\` again and retry \`cf deploy\` |
| \`App failed to start\` (generic) | Missing env var, wrong start command, or port binding issue | Check \`cf logs <app> --recent\` for the exact error; review \`manifest.yml\` |
| \`Module build failed: cds compile\` | Syntax error in a \`.cds\` file caught during the MTA build | Run \`cds compile '**/*.cds'\` locally and fix the reported error before pushing |
| \`Deployment failed: 500 Internal Server Error\` from CF deploy service | Transient CF platform issue | Check [SAP BTP Status](https://www.sap.com/about/trust-center/cloud-service-status.html); wait and retry, or contact SAP support |

---

### Fix: .cfignore to reduce mtar size

A \`.cfignore\` file works exactly like \`.gitignore\` but tells the CF buildpack staging and MBT which files to exclude from the archive.

Place it in your project root:`,
        },
        {
          kind: 'code',
          language: 'gitignore',
          filename: '.cfignore',
          content: `# Exclude local dev dependencies — buildpack installs these fresh on BTP
node_modules/
.node_modules/

# Exclude test artifacts
test/
tests/
__tests__/
*.test.js
*.spec.js
coverage/

# Exclude local config and secrets
.env
.env.*
default-env.json
default-services.json

# Exclude editor/OS files
.vscode/
.idea/
.DS_Store
Thumbs.db

# Exclude git history from the archive
.git/`,
        },
        {
          kind: 'markdown',
          content: `After adding \`.cfignore\`, rebuild with \`mbt build\` and check the archive size:

\`\`\`bash
ls -lh mta_archives/*.mtar
\`\`\`

---

### Fix: manifest.yml start command and env vars

If your app fails to start with a generic error, verify your \`manifest.yml\`:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          filename: 'manifest.yml',
          content: `applications:
  - name: my-bookshop-srv
    path: gen/srv
    buildpacks:
      - nodejs_buildpack
    # Explicit start command — do not rely on the default
    command: node node_modules/@sap/cds/bin/cds-serve
    memory: 256M
    disk_quota: 512M
    instances: 1
    # Health check — give the app time to bind to PORT
    health-check-type: http
    health-check-http-endpoint: /health
    health-check-invocation-timeout: 60
    env:
      # NODE_ENV must be production on BTP
      NODE_ENV: production
    services:
      - my-bookshop-db
      - my-bookshop-auth`,
        },
        {
          kind: 'markdown',
          content: `---

### Fix: mta.yaml requires section for service bindings

The \`Cannot read properties of undefined (reading 'db')\` error means CDS cannot find a bound database service. Check your \`mta.yaml\`:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          filename: 'mta.yaml',
          content: `modules:
  - name: my-bookshop-srv
    type: nodejs
    path: gen/srv
    requires:
      # This must match the resource name below exactly
      - name: my-bookshop-db
      - name: my-bookshop-auth
    # ...

resources:
  - name: my-bookshop-db
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared

  - name: my-bookshop-auth
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json`,
        },
        {
          kind: 'markdown',
          content: `---

### Diagnosing token expiry in CI/CD

If \`cf deploy\` fails with \`Token expired\` inside a GitHub Actions workflow, your CF credentials secret may have expired or the login step ran too far before the deploy step.

Ensure your workflow logs in immediately before deploying:

\`\`\`yaml
- name: Login to CF
  run: cf login -a \${{ vars.CF_API }} -u \${{ secrets.CF_USER }} -p \${{ secrets.CF_PASSWORD }} -o "\${{ vars.CF_ORG }}" -s "\${{ vars.CF_SPACE }}"

- name: Deploy to CF
  run: cf deploy mta_archives/*.mtar -f
\`\`\`

Keep login and deploy in the same job so they share the same CF session.`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────
    // Step 6: Health Checks & Scaling
    // ─────────────────────────────────────────────────────────────────
    {
      id: '06-monitoring-step-6',
      title: 'Health Checks & Scaling',
      contextHints: ['cf set-health-check', 'cf scale', 'cf restart-app-instance', 'health check', 'http', 'process', 'port', 'instances', 'memory', 'rolling restart'],
      completionCriteria: 'Review the health check and scaling commands for your app',
      blocks: [
        {
          kind: 'markdown',
          content: `## Health Checks & Scaling

### CF Health Check Types

Cloud Foundry uses health checks to decide whether an app instance is alive.
If a check fails repeatedly, CF marks the instance as crashed and restarts it.

| Type | How it works | Best for |
|---|---|---|
| \`http\` | CF sends an HTTP GET to an endpoint; expects 2xx | Web apps with a known health endpoint |
| \`port\` | CF checks that the app is listening on \`$PORT\` | Apps that bind a port but have no HTTP endpoint |
| \`process\` | CF just checks the process is still running | Background workers with no network binding |

The \`http\` type is the most reliable for CAP apps because it confirms the server is actually serving requests, not just alive.

---

### Adding a /health endpoint to your CAP app

Add a simple health route in your \`server.js\` (or via CDS middleware):

\`\`\`javascript
// srv/server.js
const cds = require('@sap/cds')

cds.on('bootstrap', app => {
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() })
  })
})

module.exports = cds.server
\`\`\`

---

> ✏ **Replace \`my-bookshop-srv\` in the commands below with your actual CF app name.**`,
        },
        {
          kind: 'run',
          label: 'Set HTTP health check with /health endpoint',
          command: 'cf set-health-check my-bookshop-srv http --endpoint /health',
        },
        {
          kind: 'markdown',
          content: `After changing the health check type you need to restart the app for it to take effect:

\`\`\`bash
cf restart my-bookshop-srv
\`\`\`

---

### Scaling your app

CF lets you scale horizontally (more instances) and vertically (more memory/disk) with a single command.`,
        },
        {
          kind: 'run',
          label: 'Scale to 2 instances with 512 MB memory each',
          command: 'cf scale my-bookshop-srv -i 2 -m 512M',
        },
        {
          kind: 'run',
          label: 'Restart only instance 0 (rolling restart without downtime)',
          command: 'cf restart-app-instance my-bookshop-srv 0',
        },
        {
          kind: 'markdown',
          content: `### When to scale vs when to fix the root cause

Scaling is a **temporary measure** — it should buy you time while you fix the underlying problem.

| Situation | Right move |
|---|---|
| Memory usage is consistently at 90%+ | Scale memory up (\`-m 512M\`) **and** profile for memory leaks |
| Response times are high under load | Scale instances up (\`-i 2\`) **and** add caching / query optimisation |
| Single instance keeps crashing | Do **not** just add more instances — fix the crash first |
| Deployment causes brief downtime | Use \`cf restart-app-instance\` one at a time for rolling restarts |
| CPU pegged at 100% | Likely an infinite loop or heavy computation — fix the code, not the quota |

---

### Scale flags reference

\`\`\`
cf scale <app-name> [flags]

  -i <instances>   Number of app instances  (horizontal scaling)
  -m <memory>      Memory limit per instance e.g. 256M, 1G
  -k <disk>        Disk limit per instance   e.g. 512M, 2G
  -f               Force restart without confirmation prompt
\`\`\`

Example — scale down to 1 instance after peak load:

\`\`\`bash
cf scale my-bookshop-srv -i 1 -f
\`\`\`

---

### Confirm the new state

After scaling or changing the health check, verify the app is healthy:

\`\`\`bash
cf app my-bookshop-srv
\`\`\`

All instances should show \`running\` within a minute or two.`,
        },
      ],
    },
  ],
}
