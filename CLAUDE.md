# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DevInsight API** — A diagnostic API service that analyzes requests/logs and returns human-readable explanations of errors, correction suggestions, and performance insights. Think "X-ray for APIs."

The full product specification lives in `Prompt.txt` (Portuguese). No code has been written yet — this is greenfield.

## Planned Tech Stack

- **Backend:** Node.js + Express
- **Database:** Supabase (diagnostic logs)
- **SDK:** JavaScript/TypeScript npm package
- **HTTP Client:** Axios

## Planned Architecture

```
Client SDK → POST /v1/diagnosticos → Diagnosis Engine → Supabase (logs)
```

**Core diagnostic modules:**
1. **Frontend** — hydration errors, silent failures, layout/performance issues
2. **Backend** — silent exceptions, API contract violations, integration failures
3. **SQL** — N+1 queries, missing indexes, slow queries, injection risks

**Main endpoint:** `POST /v1/diagnosticos`

Request shape:
```json
{ "url": "/users", "method": "POST", "headers": {}, "body": {}, "categoria": "backend" }
```

Response shape:
```json
{
  "problema": "string",
  "causa": "string",
  "nivel": "baixo|médio|alto",
  "categoria": "frontend|backend|sql",
  "sugestoes": ["..."],
  "confianca": 0.92
}
```

**Auth:** Bearer token (API key per tier)

**Rate limits:** Free=100/mo, Pro=1 000/mo (R$49), Scale=10 000/mo (R$149), Enterprise=custom

## Development Setup (to be implemented)

When initializing the project, the expected structure is:

```
src/
  routes/        # Express route handlers
  engines/       # Diagnostic logic per category (frontend, backend, sql)
  middleware/    # Auth, rate limiting
  db/            # Supabase client and schema
sdk/             # npm package for client-side integration
```

## Key Business Context

- Target market: startups, freelancers, SaaS companies, backend teams
- Written in Portuguese — keep user-facing messages and API field names in Portuguese (as in `Prompt.txt`)
- OpenAPI 3.0 spec is defined in `Prompt.txt` and should be kept in sync with implementation
