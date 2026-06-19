import type { Module } from '../types'

export const capSetupModule: Module = {
  id: '02-cap-setup',
  title: 'CAP Project Setup',
  icon: '🌱',
  description: 'Initialize and run a SAP CAP project locally',
  steps: [
    {
      id: '02-cap-step-1',
      title: 'What is SAP CAP?',
      contextHints: ['CAP', 'Cloud Application Programming', '@sap/cds', 'OData', 'HANA', 'service', 'entity'],
      completionCriteria: 'Read through the CAP overview and move to next step',
      blocks: [
        {
          kind: 'markdown',
          content: `## SAP Cloud Application Programming Model (CAP)

CAP is SAP's framework for building **enterprise-grade cloud applications** on BTP. It provides a high-level abstraction over OData services, HANA database, authentication, and more.

### How CAP Works

\`\`\`
You write:           CAP generates:
─────────────────    ────────────────────────────
db/schema.cds   →    Database tables (HANA / SQLite)
srv/service.cds →    OData V4 service
                →    CRUD REST endpoints
                →    Fiori-compatible metadata
\`\`\`

### CAP Project Structure

\`\`\`
my-cap-app/
├── db/
│   └── schema.cds         ← Data model (entities/tables)
├── srv/
│   └── catalog-service.cds  ← Service definition (what's exposed)
├── app/
│   └── (optional Fiori UI)
├── package.json
└── .cdsrc.json            ← CAP configuration
\`\`\`

### Key CDS (Core Data Services) Concepts

| Concept | CDS Syntax | SQL Equivalent |
|---|---|---|
| Entity | \`entity Books { ... }\` | \`CREATE TABLE\` |
| Association | \`author : Association to Authors\` | Foreign key |
| Service | \`service CatalogService { ... }\` | REST API namespace |
| Expose entity | \`entity Books as projection on my.Books\` | API endpoint |

### The CDS CLI (\`cds\`)

\`npm install -g @sap/cds-dk\` installs:
- \`cds init\` — scaffold a new project
- \`cds watch\` — run locally with hot reload
- \`cds build\` — compile for deployment
- \`cds deploy\` — deploy to database`,
        },
      ],
    },
    {
      id: '02-cap-step-2',
      title: 'Install CDS Tooling',
      contextHints: ['npm install -g', '@sap/cds-dk', 'cds version', 'global tooling', 'Node.js'],
      completionCriteria: 'Run both commands and verify cds version prints output',
      blocks: [
        {
          kind: 'markdown',
          content: `## Install the SAP CDS CLI

The \`@sap/cds-dk\` package provides the \`cds\` command globally.
You only need to do this once per machine.`,
        },
        {
          kind: 'run',
          label: 'Check Node.js version (need 18+)',
          command: 'node --version',
        },
        {
          kind: 'run',
          label: 'Install CDS globally',
          command: 'npm install -g @sap/cds-dk',
        },
        {
          kind: 'run',
          label: 'Verify CDS installation',
          command: 'cds version',
        },
        {
          kind: 'run',
          label: 'Check available CDS commands',
          command: 'cds --help',
        },
      ],
    },
    {
      id: '02-cap-step-3',
      title: 'Initialize the CAP Project',
      contextHints: ['cds init', 'project structure', 'package.json', 'db/', 'srv/', 'scaffolding'],
      completionCriteria: 'Run cds init and verify the folder structure was created',
      blocks: [
        {
          kind: 'markdown',
          content: `## Scaffold a CAP Project

\`cds init\` creates a minimal CAP project in the current directory.`,
        },
        {
          kind: 'run',
          label: 'Initialize CAP project',
          command: 'cds init .',
        },
        {
          kind: 'run',
          label: 'Install npm dependencies',
          command: 'npm install',
        },
        {
          kind: 'run',
          label: 'Show project structure',
          command: 'find . -not -path "./node_modules/*" -not -path "./.git/*" | head -40',
        },
        {
          kind: 'markdown',
          content: `After running \`cds init\`, you should see:
- \`package.json\` — with \`@sap/cds\` as a dependency
- \`db/\` — empty, ready for your data model
- \`srv/\` — empty, ready for your service
- \`.cdsrc.json\` — CAP configuration`,
        },
      ],
    },
    {
      id: '02-cap-step-4',
      title: 'Create a Data Model',
      contextHints: ['CDS entity', 'namespace', 'Books', 'Authors', 'Association', 'db/schema.cds', 'types'],
      completionCriteria: 'Edit and save db/schema.cds with the Books entity',
      blocks: [
        {
          kind: 'markdown',
          content: `## Define Your Data Model

The data model lives in \`db/schema.cds\`.
CDS uses a SQL-like syntax to define entities (tables).`,
        },
        {
          kind: 'editor',
          path: 'db/schema.cds',
          language: 'plaintext',
          description: 'Define Books and Authors entities',
          defaultContent: `namespace my.bookshop;

entity Books {
  key ID     : Integer;
  title      : String(111);
  author     : Association to Authors;
  stock      : Integer;
  price      : Decimal(9,2);
}

entity Authors {
  key ID     : Integer;
  name       : String(111);
  books      : Association to many Books on books.author = $self;
}
`,
        },
        {
          kind: 'markdown',
          content: `### CDS Type Reference

| CDS Type | Description | Example |
|---|---|---|
| \`String(n)\` | Text up to n chars | \`String(100)\` |
| \`Integer\` | Whole number | \`Integer\` |
| \`Decimal(p,s)\` | Fixed precision | \`Decimal(9,2)\` |
| \`Date\` | Date only | \`Date\` |
| \`DateTime\` | Date + time | \`DateTime\` |
| \`Boolean\` | True/false | \`Boolean\` |
| \`UUID\` | Auto-generated ID | \`key ID : UUID\` |
| \`Association to X\` | FK relationship | \`author : Association to Authors\` |`,
        },
      ],
    },
    {
      id: '02-cap-step-5',
      title: 'Create a Service',
      contextHints: ['service definition', 'CatalogService', 'projection', 'srv/catalog-service.cds', 'OData', 'expose'],
      completionCriteria: 'Edit and save srv/catalog-service.cds',
      blocks: [
        {
          kind: 'markdown',
          content: `## Define a Service

The service definition controls **what gets exposed as an API** and how.
Services live in the \`srv/\` folder.`,
        },
        {
          kind: 'editor',
          path: 'srv/catalog-service.cds',
          language: 'plaintext',
          description: 'Expose Books and Authors via OData service',
          defaultContent: `using my.bookshop as my from '../db/schema';

service CatalogService {
  entity Books   as projection on my.Books;
  entity Authors as projection on my.Authors;
}
`,
        },
        {
          kind: 'markdown',
          content: `### What this creates

\`service CatalogService { ... }\` creates an **OData V4 service** at:
\`\`\`
GET /odata/v4/catalog/Books
GET /odata/v4/catalog/Books(1)
POST /odata/v4/catalog/Books
PUT /odata/v4/catalog/Books(1)
DELETE /odata/v4/catalog/Books(1)
GET /odata/v4/catalog/Authors
\`\`\`

All CRUD operations are provided automatically — no controller code needed.`,
        },
      ],
    },
    {
      id: '02-cap-step-6',
      title: 'Run the App Locally',
      contextHints: ['cds watch', 'localhost', 'sqlite', 'hot reload', 'OData', 'test data', '.csv'],
      completionCriteria: 'Successfully start cds watch and see the service running',
      blocks: [
        {
          kind: 'markdown',
          content: `## Run Locally with \`cds watch\`

\`cds watch\` starts a local server with:
- **SQLite** as the in-memory database (no HANA needed locally)
- **Hot reload** — automatically restarts when files change
- **Mock authentication** — no BTP login required locally`,
        },
        {
          kind: 'run',
          label: 'Add some test data (optional)',
          command: `mkdir -p db/data && cat > db/data/my.bookshop-Books.csv << 'EOF'
ID,title,author_ID,stock,price
1,The Hitchhiker's Guide to the Galaxy,1,50,12.99
2,The Restaurant at the End of the Universe,1,40,13.99
3,Foundation,2,60,11.99
EOF`,
        },
        {
          kind: 'run',
          label: 'Compile CDS model (check for errors)',
          command: 'cds compile db/ srv/',
        },
        {
          kind: 'markdown',
          content: `Now start the server. The terminal will show the service URL.
Open **http://localhost:4004** in a browser to see the CAP service.

> Note: This will run until you stop it (Ctrl+C). The terminal below will stream output.`,
        },
        {
          kind: 'run',
          label: 'Start CDS development server',
          command: 'cds watch --open',
        },
      ],
    },
  ],
}
