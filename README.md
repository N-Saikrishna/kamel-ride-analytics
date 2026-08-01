# Kamel Ride Analytics

Event analytics platform for Kamel Ride, a student ride-share social app.

## Packages

| Package | Role |
| --- | --- |
| `packages/shared` | Event envelope, Zod schemas, `parseEvent` |
| `packages/server` | Fastify ingest API, Neon Postgres, migrations |

## Setup

```bash
cp .env.example .env   # set DATABASE_URL to a Neon pooled (-pooler) connection string
npm install
npm run migrate
npm run dev            # http://localhost:3000
```

### Endpoints

- `GET /health` — liveness
- `POST /events` — single event
- `POST /events/batch` — up to 500 events (207 partial success)

On Vercel, the same routes are served under `/api/*` via `api/index.ts`.

## Idempotency and dead-letter design

Clients generate `eventId` (UUID) before send. That id is the primary key of
`events`, so retries are safe: `INSERT … ON CONFLICT (id) DO NOTHING` keeps the
first write and reports `duplicate: true` (or increments `duplicates` in a
batch). We deliberately do **not** update on conflict — analytics events are
immutable facts; a replay must not rewrite `occurred_at` or `properties`.

Validation failures never enter `events`. The raw payload and Zod issues are
written to `dead_letter_events` so bad traffic is inspectable without poisoning
downstream metrics. Single ingest returns `400` with those issues; batch ingest
dead-letters only the invalid indexes, inserts the valid rows in one multi-row
statement, and returns `207` with `{ accepted, duplicates, rejected }`.

`received_at` (server clock) is stored separately from `occurred_at` (client
`timestamp`) so clock skew is visible later without losing either signal.
