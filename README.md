# Conversational Data Analyst

An app that answers natural-language questions about synthetic banking data.

## Architecture

```
User question
  → Query Planner
  → structured QueryPlan
  → QueryPlan validation
  → trusted Query Builder
  → parameterized SQL
  → SQLite
  → structured analytics result
  → frontend visualization
```

## Security

The planner/AI must **never** generate executable SQL.

The planner produces only a constrained, structured `QueryPlan`. A trusted Query Builder maps a validated plan to predefined, parameterized SQL.

## Project structure

- `client/` — React + TypeScript + Vite frontend
- `server/` — Express + TypeScript backend

## Prerequisites

- Node.js 20+

## Setup

```bash
npm install
cp .env.example .env
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev:client` | Start the Vite frontend (http://localhost:5173) |
| `npm run dev:server` | Start the Express backend (http://localhost:3001) |
| `npm run build` | Build frontend and backend |
| `npm run build:client` | Build frontend only |
| `npm run build:server` | Build backend only |
| `npm test` | Run frontend and backend tests |
| `npm run start` | Run the compiled backend |

## Current scope

This repository currently contains the project scaffold only: install, run, test, and build. Database schema, seed data, Query Planner, Query Builder, API, and full UI are not implemented yet.
