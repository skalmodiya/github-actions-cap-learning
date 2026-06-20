import type { Module } from '../types'

export const capAdvancedModule: Module = {
  id: '05-cap-advanced',
  title: 'CAP Advanced Features',
  icon: '🔐',
  description: 'Secure, scale and extend CAP apps with XSUAA, HANA, Fiori annotations, remote services, plugins and multitenancy',
  steps: [
    // ─────────────────────────────────────────────────────────────────────────
    // Step 1 — XSUAA Authentication
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '05-cap-step-1',
      title: 'XSUAA Authentication',
      contextHints: ['XSUAA', 'xs-security.json', 'OAuth2', 'scopes', 'role-templates', 'role-collections', 'cds add xsuaa', 'BTP auth'],
      completionCriteria: 'Run cds add xsuaa and save xs-security.json with scopes and role-templates',
      blocks: [
        {
          kind: 'markdown',
          content: `## XSUAA — Extended Services for User Account and Authentication

XSUAA is SAP BTP's **OAuth 2.0 / OpenID Connect authorization server**. It sits in front of your CAP service and handles:

- **Authentication** — verifying who the user is (via SAP Identity Provider or Azure AD)
- **Authorization** — JWT tokens carrying scopes your app defined
- **Single Sign-On** — one login across all BTP services in a subaccount

### How XSUAA Integrates with CAP

\`\`\`
Browser / UI5 App
      │
      │  1. Redirect to XSUAA login
      ▼
  XSUAA (SAP BTP)
      │
      │  2. Issue JWT token with scopes
      ▼
  CAP srv (Node.js)          ← validates JWT on every request
      │  @requires annotation
      │  restricts access per scope
      ▼
  HANA Cloud / SQLite
\`\`\`

### Key Concepts

| Term | Meaning |
|---|---|
| **Scope** | A permission string, e.g. \`Viewer\`, \`Admin\`. Declared in xs-security.json |
| **Role Template** | Groups scopes into an assignable role, e.g. \`BookshopAdmin\` |
| **Role Collection** | BTP-level grouping of role templates, assigned to users in the cockpit |
| **xsappname** | Unique identifier for your app within the subaccount |

### Adding XSUAA to Your Project

\`cds add xsuaa\` does three things automatically:
1. Adds \`@sap/xssec\` and \`passport\` to \`package.json\`
2. Adds the \`my-bookshop-auth\` resource block to \`mta.yaml\`
3. Creates a skeleton \`xs-security.json\`

First, point to your CAP project:`,
        },
        {
          kind: 'dirpicker',
          label: 'Which CAP project folder?',
          description: 'Enter the folder name from Module 2 (e.g. "my-bookshop"). All commands will run inside it.',
        },
        {
          kind: 'run',
          label: 'Add XSUAA support to the project',
          command: 'cds add xsuaa',
          useProjectDir: true,
        },
        {
          kind: 'markdown',
          content: `### What cds add xsuaa changed

After running the command, inspect the additions:`,
        },
        {
          kind: 'run',
          label: 'Check package.json for xssec dependency',
          command: 'grep -A 2 "xssec\\|passport" package.json || echo "Check package.json manually"',
          useProjectDir: true,
        },
        {
          kind: 'markdown',
          content: `### Edit xs-security.json

Now fill in the real scopes and role templates for your application.
The file below defines a **Viewer** scope (read-only) and an **Admin** scope (full access),
bundled into role templates that the BTP cockpit can assign to users:`,
        },
        {
          kind: 'editor',
          path: 'xs-security.json',
          language: 'json',
          description: 'XSUAA security descriptor — scopes, role-templates, role-collections',
          useProjectDir: true,
          defaultContent: `{
  "xsappname": "my-bookshop",
  "tenant-mode": "dedicated",
  "description": "Security configuration for My Bookshop CAP application",
  "scopes": [
    {
      "name": "$XSAPPNAME.Viewer",
      "description": "Read-only access to the bookshop catalogue"
    },
    {
      "name": "$XSAPPNAME.Admin",
      "description": "Full access — create, update and delete books and authors"
    }
  ],
  "attributes": [],
  "role-templates": [
    {
      "name": "BookshopViewer",
      "description": "Can browse the bookshop catalogue",
      "scope-references": [
        "$XSAPPNAME.Viewer"
      ],
      "attribute-references": []
    },
    {
      "name": "BookshopAdmin",
      "description": "Can manage books and authors",
      "scope-references": [
        "$XSAPPNAME.Viewer",
        "$XSAPPNAME.Admin"
      ],
      "attribute-references": []
    }
  ],
  "role-collections": [
    {
      "name": "Bookshop Viewer",
      "description": "Read-only users",
      "role-template-references": [
        "$XSAPPNAME.BookshopViewer"
      ]
    },
    {
      "name": "Bookshop Administrator",
      "description": "Administrator users",
      "role-template-references": [
        "$XSAPPNAME.BookshopAdmin"
      ]
    }
  ]
}
`,
        },
        {
          kind: 'markdown',
          content: `### $XSAPPNAME placeholder

\`$XSAPPNAME\` is replaced at deploy time with the \`xsappname\` field value combined with the subaccount GUID (e.g. \`my-bookshop!t12345\`). Always use the placeholder — never hardcode the full name.

### Assigning Role Collections to Users

After deployment, go to **BTP Cockpit → Security → Users**, select the user and assign the "Bookshop Administrator" or "Bookshop Viewer" role collection.`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2 — Securing CAP Services
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '05-cap-step-2',
      title: 'Securing CAP Services',
      contextHints: ['@requires', '@restrict', 'authenticated', 'unauthenticated', 'grant', 'to', 'where', 'CDS security annotations'],
      completionCriteria: 'Save catalog-service.cds with @requires and @restrict annotations',
      blocks: [
        {
          kind: 'markdown',
          content: `## Securing CAP Services with CDS Annotations

CAP uses **annotations** directly in \`.cds\` files to declare security requirements. No middleware code needed.

### @requires — Coarse-grained Access Control

\`@requires\` gates an entire service or entity to a role:

\`\`\`cds
@requires: 'authenticated-user'   // any logged-in user
service CatalogService { ... }

@requires: 'Admin'                // only users with Admin scope
service AdminService { ... }

@requires: 'system-user'         // machine-to-machine calls only
service InternalService { ... }
\`\`\`

### @restrict — Fine-grained Action-level Control

\`@restrict\` allows different permissions per HTTP verb or named action:

\`\`\`cds
entity Books @(restrict: [
  { grant: 'READ',   to: 'Viewer' },      // Viewers can read
  { grant: ['WRITE', 'CREATE', 'DELETE'], to: 'Admin' }  // Admins can write
]) as projection on my.Books;
\`\`\`

You can also add **instance-based filters** using \`where\`:

\`\`\`cds
entity Orders @(restrict: [
  { grant: 'READ', to: 'Viewer',
    where: 'createdBy = $user' }           // only see your own orders
]) as projection on my.Orders;
\`\`\`

### Unauthenticated vs Authenticated Access

| Annotation | Who can access |
|---|---|
| *(none)* | Everyone — fully public |
| \`@requires: 'authenticated-user'\` | Any logged-in user |
| \`@requires: 'Admin'\` | Users with the \`Admin\` scope/role |
| \`@restrict: [{ grant: 'READ', to: 'any' }]\` | Read is public, other verbs restricted |

Now update the service definition with real security annotations:`,
        },
        {
          kind: 'editor',
          path: 'srv/catalog-service.cds',
          language: 'plaintext',
          description: 'Secure the catalog service with @requires and @restrict',
          useProjectDir: true,
          defaultContent: `using my.bookshop as my from '../db/schema';

// ─── Public read-only catalogue ──────────────────────────────────────────────
@requires: 'authenticated-user'
service CatalogService {

  // Viewers can read; Admins can also create, update and delete
  entity Books @(restrict: [
    { grant: 'READ',                         to: ['Viewer', 'Admin'] },
    { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'Admin' }
  ]) as projection on my.Books;

  entity Authors @(restrict: [
    { grant: 'READ',                         to: ['Viewer', 'Admin'] },
    { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'Admin' }
  ]) as projection on my.Authors;

  // Bound action — Admin only
  action submitOrder(bookID: Integer, quantity: Integer)
    returns { message: String }
    @(requires: 'Admin');
}

// ─── Admin-only back-office service ──────────────────────────────────────────
@requires: 'Admin'
service AdminService {
  entity Books   as projection on my.Books;
  entity Authors as projection on my.Authors;
}
`,
        },
        {
          kind: 'markdown',
          content: `### Testing Locally with Mock Users

When running \`cds watch\` locally, CAP provides mock users so you can test without a real XSUAA instance.
Add a \`cdsrc.json\` (or the \`cds\` block in \`package.json\`) with mock user definitions:

\`\`\`json
{
  "cds": {
    "requires": {
      "auth": {
        "users": {
          "alice": { "roles": ["Admin"] },
          "bob":   { "roles": ["Viewer"] },
          "carol": { "roles": [] }
        }
      }
    }
  }
}
\`\`\`

Then call the service with a basic auth header:
\`\`\`bash
curl -u alice:  http://localhost:4004/odata/v4/admin/Books
\`\`\``,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3 — HANA Cloud Connectivity
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '05-cap-step-3',
      title: 'HANA Cloud Connectivity',
      contextHints: ['cds add hana', '@cap-js/hana', 'HDI container', 'hdi-shared', 'cds deploy --to hana', 'HANA Cloud', 'mta.yaml hana'],
      completionCriteria: 'Run cds add hana and update mta.yaml with the HANA resource',
      blocks: [
        {
          kind: 'markdown',
          content: `## Connecting CAP to SAP HANA Cloud

Locally, CAP uses **SQLite** (zero config, in-memory). In production on BTP, you use **SAP HANA Cloud** via an **HDI Container** (HANA Deployment Infrastructure).

### What is an HDI Container?

An HDI container is a **private schema** inside a HANA Cloud instance, managed for you by BTP:
- Each app gets its own isolated container
- Schema migrations are handled by the **db-deployer** (the \`hdb\` MTA module)
- No manual DDL — CAP generates and deploys the SQL artefacts

### The cds add hana command

\`cds add hana\` makes the following changes:

| File | What changes |
|---|---|
| \`package.json\` | Adds \`@cap-js/hana\` to dependencies; sets \`db.kind: "hana"\` in production profile |
| \`mta.yaml\` | Adds the \`hana\` resource block and the \`db-deployer\` module |

Run it now:`,
        },
        {
          kind: 'run',
          label: 'Add HANA support to the project',
          command: 'cds add hana',
          useProjectDir: true,
        },
        {
          kind: 'run',
          label: 'Install updated dependencies',
          command: 'npm install',
          useProjectDir: true,
        },
        {
          kind: 'markdown',
          content: `### Updated mta.yaml

After \`cds add hana\`, your \`mta.yaml\` gains a db-deployer module and an HDI container resource.
Review and adjust names to match your project:`,
        },
        {
          kind: 'editor',
          path: 'mta.yaml',
          language: 'yaml',
          description: 'mta.yaml with HANA Cloud HDI container and db-deployer',
          useProjectDir: true,
          defaultContent: `_schema-version: '3.1'
ID: my-bookshop
version: 1.0.0
description: My CAP Bookshop Application

modules:
  # ── Node.js backend ────────────────────────────────────────────
  - name: my-bookshop-srv
    type: nodejs
    path: gen/srv
    parameters:
      buildpack: nodejs_buildpack
      memory: 256M
      disk-quota: 512M
    build-parameters:
      builder: npm
    requires:
      - name: my-bookshop-db
      - name: my-bookshop-auth
    provides:
      - name: srv-api
        properties:
          srv-url: '\${default-url}'

  # ── Database schema deployer (runs once then stops) ────────────
  - name: my-bookshop-db-deployer
    type: hdb
    path: gen/db
    parameters:
      buildpack: nodejs_buildpack
    build-parameters:
      no-source: true
    requires:
      - name: my-bookshop-db

resources:
  # ── SAP HANA Cloud — HDI container ────────────────────────────
  - name: my-bookshop-db
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared
    properties:
      hdi-service-name: '\${service-name}'

  # ── XSUAA — authentication service ───────────────────────────
  - name: my-bookshop-auth
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json
      config:
        xsappname: my-bookshop-\${org}-\${space}
        tenant-mode: dedicated
`,
        },
        {
          kind: 'markdown',
          content: `### Deploy Schema to HANA (initial setup)

Before the first full MTA deployment, you can push the schema directly from the CLI if you have a running HANA Cloud instance and CF is logged in:

\`\`\`bash
# Bind to an existing HDI container service instance
cds deploy --to hana
\`\`\`

This command:
1. Runs \`cds build\` to generate HANA artefacts in \`gen/db\`
2. Creates (or reuses) a service key for the HDI container
3. Deploys the schema using the \`@sap/hdi-deploy\` tool

In normal CI/CD, the \`db-deployer\` MTA module handles this automatically during \`cf deploy\`.

### Local Development with HANA

You can also develop against HANA Cloud locally:
\`\`\`bash
# Store HANA credentials locally (never commit this file!)
cds deploy --to hana --store-credentials
cds watch --profile hybrid   # uses HANA in the cloud, mock auth locally
\`\`\``,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4 — CDS Annotations for Fiori
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '05-cap-step-4',
      title: 'CDS Annotations for Fiori',
      contextHints: ['@UI', '@title', 'UI.LineItem', 'UI.SelectionFields', 'UI.HeaderInfo', '@Capabilities', 'Fiori Elements', 'OData annotations'],
      completionCriteria: 'Save srv/annotations.cds with UI and Capabilities annotations',
      blocks: [
        {
          kind: 'markdown',
          content: `## CDS Annotations for SAP Fiori Elements

Fiori Elements generates UI automatically from **OData annotations** declared in CDS files.
You write annotations → Fiori reads them → UI renders itself. No JavaScript UI code required.

### Annotation Files

Keep UI annotations in a dedicated \`srv/annotations.cds\` file so your service definition stays clean.

### Key Annotation Vocabulary

#### @UI.HeaderInfo
Defines the title and subtitle shown at the top of object pages:
\`\`\`cds
@UI.HeaderInfo: {
  TypeName      : 'Book',
  TypeNamePlural: 'Books',
  Title         : { Value: title },
  Description   : { Value: author.name }
}
\`\`\`

#### @UI.LineItem
Columns shown in a list report table:
\`\`\`cds
@UI.LineItem: [
  { Value: ID,    Label: 'ID' },
  { Value: title, Label: 'Title' },
  { Value: stock, Label: 'Stock', Criticality: stockCriticality }
]
\`\`\`

#### @UI.SelectionFields
Which fields appear in the filter bar:
\`\`\`cds
@UI.SelectionFields: [ author_ID, title ]
\`\`\`

#### @UI.FieldGroup
Groups fields together on an object page section:
\`\`\`cds
@UI.FieldGroup #Details: {
  Data: [
    { Value: price },
    { Value: stock }
  ]
}
\`\`\`

#### @Capabilities
Controls which CRUD operations the Fiori UI enables:
\`\`\`cds
@Capabilities.Insertable : true
@Capabilities.Updatable  : true
@Capabilities.Deletable  : false    // no delete button in UI
\`\`\`

Now create the annotations file:`,
        },
        {
          kind: 'editor',
          path: 'srv/annotations.cds',
          language: 'plaintext',
          description: 'Fiori Elements UI annotations for Books and Authors',
          useProjectDir: true,
          defaultContent: `using CatalogService from './catalog-service';

// ─── Books List Report & Object Page ─────────────────────────────────────────

annotate CatalogService.Books with @(
  // Object page header
  UI.HeaderInfo: {
    TypeName      : 'Book',
    TypeNamePlural: 'Books',
    Title         : { $Type: 'UI.DataField', Value: title },
    Description   : { $Type: 'UI.DataField', Value: author.name }
  },

  // Columns in list report
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: ID,    Label: 'ID' },
    { $Type: 'UI.DataField', Value: title, Label: 'Title' },
    { $Type: 'UI.DataField', Value: author.name, Label: 'Author' },
    { $Type: 'UI.DataField', Value: stock, Label: 'Stock' },
    { $Type: 'UI.DataField', Value: price, Label: 'Price' }
  ],

  // Filter bar fields
  UI.SelectionFields: [ author_ID, title ],

  // Object page sections
  UI.Facets: [
    {
      $Type : 'UI.ReferenceFacet',
      Label : 'Book Details',
      Target: '@UI.FieldGroup#BookDetails'
    }
  ],

  UI.FieldGroup #BookDetails: {
    $Type: 'UI.FieldGroupType',
    Data : [
      { $Type: 'UI.DataField', Value: title  },
      { $Type: 'UI.DataField', Value: price  },
      { $Type: 'UI.DataField', Value: stock  }
    ]
  },

  // CRUD capabilities
  Capabilities.Insertable: true,
  Capabilities.Updatable : true,
  Capabilities.Deletable : true
);

// Column labels on entity fields
annotate CatalogService.Books with {
  ID     @title: 'Book ID';
  title  @title: 'Title'   @mandatory;
  author @title: 'Author';
  stock  @title: 'Stock'   @assert.range: [0, 9999];
  price  @title: 'Price'   @Measures.ISOCurrency: currency_code;
}

// ─── Authors List ─────────────────────────────────────────────────────────────

annotate CatalogService.Authors with @(
  UI.HeaderInfo: {
    TypeName      : 'Author',
    TypeNamePlural: 'Authors',
    Title         : { $Type: 'UI.DataField', Value: name }
  },

  UI.LineItem: [
    { $Type: 'UI.DataField', Value: ID,   Label: 'ID'   },
    { $Type: 'UI.DataField', Value: name, Label: 'Name' }
  ],

  UI.SelectionFields: [ name ],

  Capabilities.Insertable: true,
  Capabilities.Updatable : true,
  Capabilities.Deletable : false
);

annotate CatalogService.Authors with {
  ID   @title: 'Author ID';
  name @title: 'Full Name' @mandatory;
}
`,
        },
        {
          kind: 'markdown',
          content: `### Verify annotations compile

Run the CDS compiler to catch any annotation syntax errors early:`,
        },
        {
          kind: 'run',
          label: 'Compile CDS to check for annotation errors',
          command: 'cds compile srv/ --to json 2>&1 | head -30',
          useProjectDir: true,
        },
        {
          kind: 'markdown',
          content: `### Generating a Fiori Preview

While running \`cds watch\`, the CAP server serves a **Fiori preview** automatically at:

\`\`\`
http://localhost:4004/$fiori-preview?service=CatalogService&entity=Books
\`\`\`

This renders a real Fiori Elements list report using the annotations you just wrote — no UI project needed.`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 5 — Remote Services & Destinations
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '05-cap-step-5',
      title: 'Remote Services & Destinations',
      contextHints: ['remote service', 'cds.requires', 'destination', 'cf create-service', 'S/4HANA', 'external API', 'BTP Destination service'],
      completionCriteria: 'Configure a remote service in package.json and create a destination service instance',
      blocks: [
        {
          kind: 'markdown',
          content: `## Consuming External APIs from CAP

CAP can act as a **proxy and mediator** for external APIs — S/4HANA, Ariba, SuccessFactors, or any REST/OData service.
This keeps your clients talking to one uniform API while CAP handles authentication and protocol differences.

### How Remote Services Work

\`\`\`
UI / client
     │
     ▼
CAP srv  (your service)
     │
     │  cds.connect.to('S4')
     ▼
BTP Destination service
     │
     ▼
External API  (e.g. S/4HANA Cloud)
\`\`\`

### Step 1 — Declare the remote service in package.json

The \`cds.requires\` section tells CAP how to connect to each external service.
For local development you can point it at a mock or sandbox URL.
On BTP, you use a **Destination** (a named connection config stored in BTP).`,
        },
        {
          kind: 'code',
          language: 'json',
          filename: 'package.json (cds.requires section)',
          content: `{
  "name": "my-bookshop",
  "dependencies": {
    "@sap/cds": "^9",
    "@cap-js/hana": "^1",
    "@sap-cloud-sdk/http-client": "^3"
  },
  "cds": {
    "requires": {
      "S4": {
        "kind": "odata-v4",
        "model": "srv/external/API_BUSINESS_PARTNER",
        "[production]": {
          "kind": "odata-v4",
          "credentials": {
            "destination": "my-s4-destination",
            "path": "/sap/opu/odata/sap/API_BUSINESS_PARTNER"
          }
        },
        "[development]": {
          "kind": "odata-v4",
          "credentials": {
            "url": "https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER"
          }
        }
      },
      "db": {
        "kind": "sql"
      }
    }
  }
}`,
        },
        {
          kind: 'markdown',
          content: `### Step 2 — Import the external API definition

Use the SAP Business Accelerator Hub to download the API specification, then import it:

\`\`\`bash
# Import from the SAP Business Hub EDMX
cds import srv/external/API_BUSINESS_PARTNER.edmx --as cds
\`\`\`

This creates \`srv/external/API_BUSINESS_PARTNER.cds\` — CAP's CDS representation of the external service.

### Step 3 — Use the remote service in your CAP service handler

\`\`\`javascript
// srv/catalog-service.js
const cds = require('@sap/cds')

module.exports = class CatalogService extends cds.ApplicationService {
  async init() {
    // Connect to the remote S/4HANA service
    const S4 = await cds.connect.to('S4')

    this.on('READ', 'BusinessPartners', async (req) => {
      // Delegate the request to S/4HANA and return the result
      return S4.run(req.query)
    })

    return super.init()
  }
}
\`\`\`

### Step 4 — Create the Destination service on BTP

The BTP **Destination service** stores named HTTP connections (URL + credentials) centrally.
Your CAP app looks up the connection by name — credentials never go in your code.`,
        },
        {
          kind: 'run',
          label: 'Create the Destination service instance',
          command: 'cf create-service destination lite my-destination',
        },
        {
          kind: 'run',
          label: 'Add Destination service to cds add destinations',
          command: 'cds add destinations',
          useProjectDir: true,
        },
        {
          kind: 'markdown',
          content: `### Add the Destination resource to mta.yaml

After \`cds add destinations\`, mta.yaml gains:

\`\`\`yaml
resources:
  - name: my-bookshop-destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite
\`\`\`

And the \`my-bookshop-srv\` module's \`requires\` list gains:
\`\`\`yaml
requires:
  - name: my-bookshop-destination
\`\`\`

### Configure the Destination in BTP Cockpit

Go to **BTP Cockpit → Connectivity → Destinations → New Destination**:

| Field | Value |
|---|---|
| Name | \`my-s4-destination\` (matches your package.json) |
| Type | \`HTTP\` |
| URL | \`https://my-s4-tenant.s4hana.ondemand.com\` |
| Authentication | \`OAuth2SAMLBearerAssertion\` (for S/4HANA Cloud) |
| Proxy Type | \`Internet\` |`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 6 — CAP Plugins
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '05-cap-step-6',
      title: 'CAP Plugins',
      contextHints: ['@cap-js/audit-logging', '@cap-js/notifications', '@cap-js/attachments', 'plugin', 'cds plugin', 'npm add'],
      completionCriteria: 'Install at least one CAP plugin and review its configuration',
      blocks: [
        {
          kind: 'markdown',
          content: `## CAP Plugin Architecture

CAP has a first-class **plugin system** — packages that hook into CAP's event lifecycle to add cross-cutting capabilities without any boilerplate in your service code.

### How Plugins Work

A CAP plugin is an npm package that:
1. Exports a CDS plugin object
2. Registers \`before\` / \`after\` / \`on\` handlers on CAP's global event bus
3. Optionally contributes CDS model extensions (new entities, annotations)

You install the package → it activates automatically. No \`require()\` needed.

### Available Official CAP Plugins

| Plugin | Purpose |
|---|---|
| \`@cap-js/audit-logging\` | Log data access and changes to SAP Audit Log service |
| \`@cap-js/notifications\` | Push notifications via SAP Alert Notification service |
| \`@cap-js/attachments\` | Store file attachments in SAP Object Store / S3 |
| \`@cap-js/sdm\` | Document management via SAP Document Management |
| \`@cap-js/change-tracking\` | Track and display field-level changes |
| \`@cap-js/telemetry\` | OpenTelemetry traces and metrics |

---

### Plugin 1 — Audit Logging

Automatically logs every read and write to your entities to the SAP Audit Log Service.
Activate with a single annotation: \`@PersonalData\`.`,
        },
        {
          kind: 'run',
          label: 'Install audit-logging plugin',
          command: 'npm add @cap-js/audit-logging',
          useProjectDir: true,
        },
        {
          kind: 'code',
          language: 'plaintext',
          filename: 'db/schema.cds — add @PersonalData annotation',
          content: `namespace my.bookshop;
using { cuid, managed } from '@sap/cds/common';

// Mark this entity for audit logging — CAP will log reads/writes automatically
@PersonalData.EntitySemantics: 'DataSubject'
entity Authors : cuid, managed {
  @PersonalData.FieldSemantics: 'DataSubjectID'
  key ID   : Integer;

  @PersonalData.IsPotentiallyPersonal
  name     : String(111);

  books    : Association to many Books on books.author = $self;
}

entity Books : cuid, managed {
  key ID   : Integer;
  title    : String(111);
  author   : Association to Authors;
  stock    : Integer;
  price    : Decimal(9,2);
}`,
        },
        {
          kind: 'markdown',
          content: `In production, bind the **SAP Audit Log Service** (\`auditlog\` / \`premium\` plan) and the plugin routes all audit events there automatically.

---

### Plugin 2 — Notifications

Send push alerts via SAP Alert Notification service from your CAP event handlers:`,
        },
        {
          kind: 'run',
          label: 'Install notifications plugin',
          command: 'npm add @cap-js/notifications',
          useProjectDir: true,
        },
        {
          kind: 'code',
          language: 'javascript',
          filename: 'srv/catalog-service.js — send a notification',
          content: `const cds = require('@sap/cds')

module.exports = class CatalogService extends cds.ApplicationService {
  async init() {
    const { notify } = cds.notifications   // provided by @cap-js/notifications

    this.after('CREATE', 'Books', async (book) => {
      await notify({
        NotificationTypeKey : 'NewBook',
        NotificationTypeVersion: '1',
        Priority            : 'MEDIUM',
        Recipients          : [{ RecipientId: 'admin@example.com' }],
        Properties          : [
          { Key: 'title',  IsSensitive: false, Language: 'en',
            Value: book.title, Type: 'String' }
        ]
      })
    })

    return super.init()
  }
}`,
        },
        {
          kind: 'markdown',
          content: `---

### Plugin 3 — Attachments

Add file upload/download to any entity with a single annotation:`,
        },
        {
          kind: 'run',
          label: 'Install attachments plugin',
          command: 'npm add @cap-js/attachments',
          useProjectDir: true,
        },
        {
          kind: 'code',
          language: 'plaintext',
          filename: 'db/schema.cds — enable attachments on Books',
          content: `using { Attachments } from '@cap-js/attachments';

entity Books {
  key ID    : Integer;
  title     : String(111);
  author    : Association to Authors;
  stock     : Integer;
  price     : Decimal(9,2);

  // Add file attachments — provided by @cap-js/attachments
  attachments : Composition of many Attachments;
}`,
        },
        {
          kind: 'markdown',
          content: `CAP automatically adds OData endpoints for attachment upload, download and deletion.
In production, bind an **SAP Object Store** service instance and files are stored in BTP-managed S3.

Locally, attachments are stored on the filesystem — no extra setup needed.`,
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Step 7 — Multitenancy with MTX
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: '05-cap-step-7',
      title: 'Multitenancy with MTX',
      contextHints: ['multitenancy', 'SaaS', 'mtx', 'cds add mtx', '@sap/cds-mtxs', 'tenant onboarding', 'tenant offboarding', 'HDI container per tenant'],
      completionCriteria: 'Run cds add mtx and review the MTX configuration in package.json',
      blocks: [
        {
          kind: 'markdown',
          content: `## Multitenancy with @sap/cds-mtxs

**Multitenancy** lets you run a **single deployed application** that serves multiple independent customers (tenants), each with full data isolation.

### SaaS on BTP — The Concept

\`\`\`
SAP BTP Global Account
  ├── Provider Subaccount        ← your CAP app runs here
  │     ├── my-bookshop-srv      ← one Node.js app
  │     └── my-bookshop-mtx      ← MTX sidecar service
  │
  └── Consumer Subaccounts
        ├── Tenant A             ← subscribes to your app
        │     └── HDI container  ← isolated DB schema
        ├── Tenant B
        │     └── HDI container
        └── Tenant C
              └── HDI container
\`\`\`

### What MTX Does

| Feature | Description |
|---|---|
| **Onboarding** | Creates a new HDI container + deploys schema when a tenant subscribes |
| **Offboarding** | Tears down the tenant's HDI container when they unsubscribe |
| **Tenant isolation** | Each request carries a tenant ID; CAP routes DB calls to the right schema |
| **Model extension** | Tenants can optionally extend the data model with custom fields |
| **Upgrade** | Schema migrations run per-tenant when you redeploy |

### Prerequisites

- SAP BTP subaccount with Cloud Foundry enabled
- HANA Cloud instance shared across tenants
- SaaS Provisioning Service (\`saas-registry\`) service instance
- XSUAA in \`application\` tenant-mode (already done in Step 1)

### Add MTX to your project`,
        },
        {
          kind: 'run',
          label: 'Add multitenancy (MTX) support',
          command: 'cds add mtx',
          useProjectDir: true,
        },
        {
          kind: 'run',
          label: 'Install MTX dependencies',
          command: 'npm install',
          useProjectDir: true,
        },
        {
          kind: 'markdown',
          content: `### What cds add mtx changes

1. Adds \`@sap/cds-mtxs\` to \`package.json\` dependencies
2. Adds an \`mtx\` sidecar module to \`mta.yaml\`
3. Adds a \`saas-registry\` resource to \`mta.yaml\`
4. Adds MTX configuration to the \`cds\` block in \`package.json\`

### MTX Configuration in package.json`,
        },
        {
          kind: 'code',
          language: 'json',
          filename: 'package.json — complete MTX configuration',
          content: `{
  "name": "my-bookshop",
  "version": "1.0.0",
  "dependencies": {
    "@sap/cds": "^9",
    "@sap/cds-mtxs": "^2",
    "@cap-js/hana": "^1",
    "@sap/xssec": "^4",
    "passport": "^0.7"
  },
  "cds": {
    "profile": "with-mtx-sidecar",
    "requires": {
      "auth": {
        "kind": "xsuaa"
      },
      "db": {
        "kind": "hana"
      },
      "multitenancy": true,
      "toggles": true,
      "extensibility": true
    },
    "mtx": {
      "element-prefix": "Z_",
      "namespace-blacklist": ["com.sap.", "sap."],
      "extension-allowlist": [
        {
          "for": ["my.bookshop.Books"],
          "new-fields": true,
          "new-entities": false
        }
      ]
    }
  }
}`,
        },
        {
          kind: 'markdown',
          content: `### Updated mta.yaml for Multitenancy

\`cds add mtx\` adds two new blocks to your mta.yaml:`,
        },
        {
          kind: 'code',
          language: 'yaml',
          filename: 'mta.yaml — MTX sidecar and SaaS registry additions',
          content: `# ── MTX sidecar (handles tenant lifecycle) ───────────────────────
- name: my-bookshop-mtx
  type: nodejs
  path: mtx/sidecar
  parameters:
    memory: 256M
    disk-quota: 1024M
  build-parameters:
    builder: npm
  requires:
    - name: my-bookshop-db
    - name: my-bookshop-auth
    - name: my-bookshop-registry
  provides:
    - name: mtx-api
      properties:
        mtx-url: '\${default-url}'

# ── Resources ────────────────────────────────────────────────────
resources:
  # SaaS Provisioning service (handles subscribe/unsubscribe)
  - name: my-bookshop-registry
    type: org.cloudfoundry.managed-service
    parameters:
      service: saas-registry
      service-plan: application
      config:
        xsappname: my-bookshop
        appName: my-bookshop
        displayName: My Bookshop
        description: SAP CAP Bookshop SaaS Application
        category: 'Custom Apps'
        appUrls:
          getDependencies: ~{mtx-api/mtx-url}/-/cds/saas-provisioning/dependencies
          onSubscription: ~{mtx-api/mtx-url}/-/cds/saas-provisioning/tenant/{tenantId}
          onSubscriptionAsync: true
          onUnSubscriptionAsync: true

  # HANA Cloud — one shared instance, isolated HDI containers per tenant
  - name: my-bookshop-db
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared`,
        },
        {
          kind: 'markdown',
          content: `### Tenant Onboarding Flow

When a customer subscribes to your SaaS app in BTP:

\`\`\`
1. Customer clicks "Subscribe" in BTP cockpit
         │
2. SaaS Registry calls POST /-/cds/saas-provisioning/tenant/{tenantId}
         │
3. MTX sidecar creates a new HDI container for the tenant
         │
4. MTX deploys the current schema to the new container
         │
5. Customer can now access the app — all data is isolated in their container
\`\`\`

### Testing Multitenancy Locally

\`\`\`bash
# Start the MTX sidecar locally (separate terminal)
cds serve mtx/sidecar

# Simulate tenant onboarding
curl -X PUT http://localhost:4005/-/cds/saas-provisioning/tenant/my-test-tenant \\
  -H "Content-Type: application/json" \\
  -d '{"subscribedTenantId": "my-test-tenant", "subscriptionAppName": "my-bookshop"}'

# Call the main app as a specific tenant (header-based routing locally)
curl -H "tenantId: my-test-tenant" http://localhost:4004/odata/v4/catalog/Books
\`\`\`

### xs-security.json changes for SaaS

Change \`tenant-mode\` from \`dedicated\` to \`shared\` when going multitenant:

\`\`\`json
{
  "xsappname": "my-bookshop",
  "tenant-mode": "shared",
  ...
}
\`\`\`

This allows the same XSUAA app to issue tokens for multiple tenants.`,
        },
        {
          kind: 'run',
          label: 'Verify MTX sidecar folder was created',
          command: 'ls -la mtx/ 2>/dev/null || echo "mtx/ folder not found — run cds add mtx first"',
          useProjectDir: true,
        },
        {
          kind: 'run',
          label: 'Show full project structure after all additions',
          command: 'find . -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./gen/*" | sort',
          useProjectDir: true,
        },
      ],
    },
  ],
}
