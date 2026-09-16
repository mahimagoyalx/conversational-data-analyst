# Conversational Data Analyst

A full-stack app that answers natural-language questions about synthetic banking data using a constrained analytics pipeline.

## 1. Project overview

This repository is an npm workspaces monorepo with:

- `client/` — React + TypeScript + Vite chat UI
- `server/` — Express + TypeScript API, SQLite database, QueryPlan planner, trusted QueryBuilder

Users ask questions in plain English. The server interprets intent into a structured `QueryPlan`, validates it, maps it to predefined parameterized SQL, executes that SQL against SQLite, and returns a natural-language answer plus visualization data. The frontend renders KPI cards, tables, and Recharts charts, and supports copying the answer or result data.

## 2. Problem statement

Build a conversational analytics experience for banking-style questions (onboarding volume, rejection rates, transaction value) without letting natural language or an AI planner emit unrestricted SQL.

The hard requirement is a clear safety boundary:

1. Natural language is interpreted into a constrained `QueryPlan`.
2. The `QueryPlan` is validated.
3. The QueryBuilder maps only validated plans to predefined parameterized SQL.
4. The application never executes unrestricted AI-generated SQL.

## 3. Features

Implemented in this repository:

- Natural-language chat over synthetic banking data
- Constrained `MockQueryPlanner` that produces structured `QueryPlan` objects (no SQL)
- Zod validation for chat requests and QueryPlans
- Trusted QueryBuilder with SELECT-only SQL templates and `?` parameters
- Structured analytics responses: answer text, columns, rows, visualization hint
- Visualizations: KPI, table, bar, line
- Suggested starter questions in the UI
- Copy Answer / Copy Data (tab-separated) via the Clipboard API
- Health endpoint plus OpenAPI / Swagger UI
- Vitest coverage for planner, QueryPlan contract, QueryBuilder, API, and SQL safety

## 4. Technology stack

| Layer | Choices |
| --- | --- |
| Language | TypeScript |
| Frontend | React 19, Vite 7, Recharts |
| Backend | Express 5, Zod, swagger-ui-express |
| Database | SQLite via better-sqlite3 |
| Tooling | npm workspaces, tsx, Vitest, Testing Library |

Node.js **20+** is required (`engines` in the root `package.json`).

## 5. Architecture

```
Browser (React)
  → POST /api/chat { question }
  → ChatService
      → QueryPlanner (MockQueryPlanner)
      → parseQueryPlan (Zod)
      → buildQuery (trusted templates + params)
      → better-sqlite3 prepare/all
      → analyticsPresenter (answer + visualization)
  → JSON analytics result
  → Message UI (KPI / chart / table + copy actions)
```

Important modules:

| Concern | Location |
| --- | --- |
| QueryPlan schema | `server/src/schemas/queryPlan.ts` |
| Planner | `server/src/planner/queryPlanner.ts` |
| QueryBuilder | `server/src/services/queryBuilder.ts` |
| Chat orchestration | `server/src/services/chatService.ts` |
| Result presentation | `server/src/services/analyticsPresenter.ts` |
| HTTP API | `server/src/routes/api.ts` |
| OpenAPI | `server/src/docs/openapi.ts` |
| Frontend chat | `client/src/components/Chat.tsx` |

## 6. End-to-end data flow

1. The user submits a question in the React chat UI (or via `POST /api/chat`).
2. The Vite dev server proxies `/api` to `http://127.0.0.1:3001`.
3. `ChatRequestSchema` requires a non-empty `question` and rejects unknown fields (including any `sql` field).
4. `MockQueryPlanner` normalizes the text, detects analytical intent, and builds a draft plan object **without SQL**.
5. SQL-like input (`SELECT`, `DROP`, `DELETE`, `UPDATE`, and similar) is treated as unsupported.
6. `parseQueryPlan` validates dataset, metric, filters, grouping, date range, and limit rules.
7. `buildQuery` selects a predefined template from `SQL_TEMPLATES` and binds dynamic values as parameters.
8. better-sqlite3 executes the trusted `SELECT`.
9. `presentAnalytics` chooses visualization type, formats rows, and writes a concise answer from the returned numbers only.
10. The client renders the result and optionally copies the answer or TSV table data.

## 7. Project structure

```
conversational-data-analyst/
├── client/                      # React + Vite frontend
│   ├── src/
│   │   ├── api.ts
│   │   ├── components/          # Chat, Message, charts, table, copy
│   │   ├── clipboard.ts
│   │   └── ...
│   └── package.json
├── server/                      # Express + SQLite backend
│   ├── src/
│   │   ├── app.ts
│   │   ├── index.ts
│   │   ├── db/                  # schema, seed, setup, dictionary
│   │   ├── docs/                # OpenAPI + Swagger mount
│   │   ├── http/                # errors + error handler
│   │   ├── planner/
│   │   ├── routes/
│   │   ├── schemas/
│   │   └── services/
│   ├── test/                    # Vitest suites
│   └── package.json
├── .env.example
├── package.json                 # workspace scripts
└── README.md
```

Generated local artefacts (`node_modules/`, `dist/`, `*.db`, `.env`) are gitignored.

## 8. Database schema

SQLite tables (see `server/src/db/schema.sql`):

### `branches`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `name` | TEXT | NOT NULL |
| `city` | TEXT | NOT NULL |

### `customers`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `name` | TEXT | NOT NULL |
| `segment` | TEXT | `Retail` \| `SME` \| `Corporate` |
| `branch_id` | INTEGER | FK → `branches.id` |

### `onboarding_applications`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `customer_id` | INTEGER | FK → `customers.id` |
| `branch_id` | INTEGER | FK → `branches.id` |
| `application_date` | TEXT | `YYYY-MM-DD` |
| `status` | TEXT | `Approved` \| `Rejected` \| `Pending` |
| `rejection_reason` | TEXT | Required when Rejected; otherwise NULL |

### `transactions`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `customer_id` | INTEGER | FK → `customers.id` |
| `transaction_date` | TEXT | `YYYY-MM-DD` |
| `amount` | REAL | `> 0` |

Indexes exist for common filters and joins (segment, status, dates, foreign keys). Foreign keys are enabled with `PRAGMA foreign_keys = ON`.

Full column notes: `server/src/db/DATA_DICTIONARY.md`.

## 9. Table relationships

```
branches 1 ── * customers
branches 1 ── * onboarding_applications
customers 1 ── * onboarding_applications
customers 1 ── * transactions
```

- Each customer belongs to one home branch.
- Each onboarding application references both a customer and the branch that handled it.
- Transactions belong to customers; segment/branch for transaction analytics are derived through `customers` when needed.

## 10. Synthetic data assumptions

Seeded by `server/src/db/seed.sql` via `npm run db:setup`:

| Table | Seeded rows |
| --- | --- |
| `branches` | 5 |
| `customers` | 50 |
| `onboarding_applications` | 150 |
| `transactions` | 200 |

Assumptions encoded in the seed and schema:

- Amounts are in INR.
- Dates are ISO `YYYY-MM-DD` text values.
- Customer segments are only Retail, SME, Corporate.
- Onboarding statuses are only Approved, Rejected, Pending.
- Rejected applications always have a non-empty rejection reason.
- Transaction amounts are positive.
- Data is deterministic so analytics answers stay stable across local setups.
- The SQLite file is local-only and is not committed (`*.db` is gitignored). Default path: `server/data/bank.db`.

## 11. Setup prerequisites

- Node.js **20+**
- npm (bundled with Node)
- Native build tooling for `better-sqlite3` (typical macOS/Linux Node installs already work)

## 12. Installation

From the repository root:

```bash
npm install
cp .env.example .env
npm run db:setup
```

## 13. Environment variables

Defined in `.env.example`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | Express listen port |
| `DATABASE_PATH` | `./data/bank.db` | SQLite file path relative to the server package when using npm scripts |

`.env` is gitignored. Copy from `.env.example` before running the server if you want local overrides.

## 14. Database initialization

```bash
npm run db:setup
```

This runs `server/src/db/setup.ts`, which:

1. Resolves `DATABASE_PATH` (or the default under `server/data/`)
2. Recreates the database file
3. Applies `schema.sql`
4. Loads `seed.sql`
5. Prints row counts and simple breakdowns

## 15. Running the backend

Development (TypeScript via `tsx watch`):

```bash
npm run dev:server
```

The API listens on **http://127.0.0.1:3001** (IPv4 loopback).

Production-style compiled run:

```bash
npm run build:server
npm run start
```

`npm run start` executes `node dist/index.js` in the server workspace after a build.

## 16. Running the frontend

In a second terminal:

```bash
npm run dev:client
```

Vite serves the UI at **http://127.0.0.1:5173** and proxies `/api` to `http://127.0.0.1:3001`.

Keep the backend running while using the chat UI.

## 17. Running tests

```bash
npm test
```

Workspace-specific:

```bash
npm run test:server
npm run test:client
```

Server suites cover QueryPlan validation, planner phrasings, QueryBuilder parameterization, chat API behaviour, and SQL safety (destructive questions must not execute). Client suites cover UI smoke behaviour and clipboard helpers.

Build both packages:

```bash
npm run build
```

## 18. API documentation

With the backend running:

| Resource | URL |
| --- | --- |
| Swagger UI | http://127.0.0.1:3001/api/docs |
| OpenAPI JSON | http://127.0.0.1:3001/api/openapi.json |
| Health | `GET /api/health` |
| Chat | `POST /api/chat` |

### `GET /api/health`

```json
{ "success": true, "data": { "status": "ok" } }
```

### `POST /api/chat`

Request:

```json
{ "question": "How many Retail customers were onboarded?" }
```

Success response shape:

```json
{
  "success": true,
  "data": {
    "answer": "…",
    "visualization": { "type": "kpi", "title": "…" },
    "columns": [{ "key": "value", "label": "…" }],
    "rows": [{ "value": 53 }]
  }
}
```

`visualization.type` is one of `kpi` | `table` | `bar` | `line`.

Error responses always look like:

```json
{
  "success": false,
  "error": { "code": "unsupported_question", "message": "…" }
}
```

SQL, stack traces, and database paths are not returned to the client.

## 19. Supported analytical capabilities

Onboarding (`dataset: "onboarding"`):

- Overall application count
- Count by customer segment
- Count by branch
- Monthly application volume (`dateGroupBy: "month"`)
- Filters by segment (Retail / SME / Corporate)
- Filters by status (Approved / Rejected / Pending)
- Segment comparisons (for example Retail vs SME)
- Overall rejection rate
- Rejection rate by branch

Transactions (`dataset: "transactions"`):

- Total transaction value (`sum`)
- Average transaction value (`average`)
- Transaction value by customer
- Top N customers by transaction value (`limit` 1–10)

Inventory-style counts:

- Number of branches (`dataset: "branches"`, `metric: "count"`)
- Number of customers, optionally filtered/grouped by segment or branch (`dataset: "customers"`)

Unsupported today (and rejected or not planned):

- Arbitrary free-form SQL
- Combining monthly onboarding with segment/branch filters or grouping in one QueryBuilder template
- Transaction count questions (“how many transactions”)
- Average onboarding time, city breakdowns, weather, and other out-of-vocabulary topics
- Auth, multi-tenant data, streaming LLM planners, or Dockerized Postgres

## 20. Example natural-language questions

These map to validated QueryPlans in the current planner:

- How many Retail customers were onboarded?
- What's the Retail onboarding volume?
- Give me the number of Retail onboarding applications.
- Show onboarding volume by segment.
- Give me a segment-wise breakdown of onboarding.
- Compare Retail and SME onboarding.
- Which branches have the highest rejection rate?
- How many applications were rejected?
- What is the total transaction value?
- What's the average transaction value?
- Show the top five customers by transaction value.
- Show the top 3 customers by transaction value.
- Show monthly onboarding volume.
- How many branches are there?
- How many customers are there?

Equivalent phrasings of the same intent are intended to produce the same QueryPlan.

## 21. QueryPlan architecture

A `QueryPlan` is a strict JSON-shaped object. It must **never** contain SQL.

Core fields (`server/src/schemas/queryPlan.ts`):

| Field | Role |
| --- | --- |
| `dataset` | `onboarding` \| `transactions` \| `branches` \| `customers` |
| `metric` | `count` \| `sum` \| `average` \| `rejection_rate` |
| `groupBy` | optional: `segment`, `branch`, and/or `customer` |
| `dateGroupBy` | optional: `month` (onboarding count only) |
| `filters.segments` | optional Retail / SME / Corporate list |
| `filters.statuses` | optional Approved / Rejected / Pending list |
| `dateRange` | optional `{ from?, to? }` ISO dates |
| `limit` | optional integer 1–10 for top customers by value |

Zod rules reject incompatible combinations (for example `sum` on onboarding, customer grouping on onboarding, limit outside top-customer queries, unknown keys such as `sql`).

The planner interface is:

```ts
interface QueryPlanner {
  plan(question: string): PlannerResult
}
```

`MockQueryPlanner` is the current implementation. It can be replaced later without changing QueryBuilder or the SQL safety boundary.

## 22. SQL safety approach

Security boundary (enforced in code and tests):

> Natural language is interpreted into a constrained QueryPlan.  
> The QueryPlan is validated.  
> The QueryBuilder maps only validated plans to predefined parameterized SQL.  
> The application never executes unrestricted AI-generated SQL.

Concrete controls:

1. **No SQL from the client** — request schema is strict; extra fields fail with `invalid_request`.
2. **No SQL from the planner** — planner output is a plan object; SQL-looking questions are unsupported.
3. **Zod re-validation** — `ChatService` re-parses planner output before building SQL.
4. **Trusted templates only** — `SQL_TEMPLATES` are fixed SELECT statements; `buildQuery` refuses SQL that is not in that set.
5. **Parameterized values** — segments, statuses, date bounds, and limits are bound with `?` / `json_each(?)`, not string-concatenated into SQL.
6. **SELECT-only guard** — templates must start with `SELECT`, contain no `;`, and must not include `DROP` / `DELETE` / `UPDATE` / `INSERT` / etc.
7. **Destructive question tests** — inputs such as `DROP TABLE customers`, `DELETE FROM customers`, `UPDATE …`, `SELECT * FROM customers`, and `Show onboarding; DROP TABLE customers` are rejected and must not change row counts.

## 23. Error handling

Structured client-safe errors (`server/src/http/errors.ts`):

| Code | Typical HTTP status | When |
| --- | --- | --- |
| `invalid_request` | 400 | Empty question, malformed JSON, unknown request fields |
| `unsupported_question` | 422 | Outside supported analytics vocabulary / SQL-like input |
| `invalid_plan` | 500 | Planner returned an invalid or unbuildable plan |
| `database_error` | 500 | SQLite execution failure |
| `internal_error` | 500 | Unexpected server failure |

The Express error handler never exposes stack traces, SQL, or filesystem paths.

## 24. Assumptions

- Single-user local screening demo; no authentication.
- English-language questions with the banking vocabulary above.
- One SQLite database file per environment.
- `MockQueryPlanner` pattern matching is sufficient for the assessment; it is not a large language model.
- Frontend and backend run as separate processes during development.
- Currency formatting uses Indian locale conventions (`en-IN`, ₹) for transaction amounts.

## 25. Known limitations

- Planner coverage is intent-based heuristics, not full NLU; unusual wording may return `unsupported_question`.
- Monthly onboarding cannot be combined with segment/branch grouping or filters in the current QueryBuilder templates.
- One UI suggestion historically phrases “monthly … by customer segment”; that combined intent is not a supported QueryBuilder path—ask monthly volume or segment breakdown separately.
- Rejection rate by segment is not implemented in QueryBuilder (branch grouping is).
- Date-range filters exist on the QueryPlan contract and some templates, but the current planner does not extract relative date phrases from natural language.
- No pagination, exports beyond clipboard, multi-turn memory, or user accounts.
- Clipboard write may fail in restricted browser contexts; the UI shows a temporary failure state.
- Server binds to `127.0.0.1` only (local assessment use).

## 26. Productionisation considerations

If this were hardened beyond a screening exercise:

- Replace or augment `MockQueryPlanner` with a model that still emits only QueryPlan JSON behind the same Zod gate
- Add authentication, rate limiting, audit logs, and request IDs
- Separate read replicas / managed Postgres if data volume grows, while keeping the trusted QueryBuilder boundary
- Migrate schema with versioned migrations instead of recreate-from-seed
- Observability for planner unsupported rates, builder rejects, and query latency
- Content Security Policy and HTTPS termination in front of the API
- Stronger clipboard/permission UX and accessibility review for the chat UI
- CI that runs `npm test` and `npm run build` on every change

Do **not** “productionise” by letting an LLM emit SQL strings.

## 27. AI tooling disclosure

Cursor was used extensively for:

- boilerplate
- implementation assistance
- tests
- debugging
- refactoring

The candidate personally made the architectural decisions around:

- frontend/backend separation
- SQLite
- database model
- QueryPlan design
- planner abstraction
- SQL safety boundary
- validation
- testing
- supported analytics vocabulary

## Quick start checklist

```bash
npm install
cp .env.example .env
npm run db:setup
npm run dev:server
# other terminal
npm run dev:client
```

Then open http://127.0.0.1:5173 for the chat UI, or http://127.0.0.1:3001/api/docs for Swagger.
