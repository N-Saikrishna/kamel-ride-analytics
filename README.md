# Kamel Ride Analytics

An event collection and analytics system for Kamel Ride, a student ride-share social app. The stack is end-to-end TypeScript: a traffic simulator posts coherent session events to an ingestion API, Zod validates them into Postgres (`events` and `dead_letter_events`), SQL aggregations expose a metrics API, and a React dashboard renders the results.

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict), ES modules, npm workspaces monorepo |
| Backend | Fastify — light HTTP layer that wraps cleanly as a Vercel serverless handler |
| Validation | Zod — one schema shared by simulator, API, and dashboard |
| Database | Postgres (Neon serverless) |
| Frontend | React, Vite, Recharts |
| Testing | Node.js test runner (`node:test` via `tsx`) |
| Deployment | Configured for Vercel serverless (`api/index.ts` + `vercel.json`); runs locally by default |

## Architecture

```
┌──────────────┐   POST /events          ┌─────────────────┐
│  simulator   │   POST /events/batch    │  Fastify API    │
│  (sessions)  │ ───────────────────────►│  Zod parseEvent │
└──────────────┘                         └────────┬────────┘
                                                  │
                         valid ───────────────────┼──────────────── invalid
                         │                        │                        │
                         ▼                        │                        ▼
              INSERT … ON CONFLICT                │           INSERT dead_letter_events
              DO NOTHING (idempotent)             │           (raw + Zod issues)
                         │                        │
                         ▼                        │
              ┌─────────────────────┐             │
              │  Postgres (Neon)    │◄────────────┘
              │  events             │
              │  dead_letter_events │
              └──────────┬──────────┘
                         │
                         │  SQL aggregates (percentile_cont, generate_series, …)
                         ▼
              ┌─────────────────────┐     GET /metrics/*      ┌──────────────┐
              │  metrics endpoints  │ ───────────────────────►│  React +     │
              │  summary, funnel,   │                         │  Recharts UI │
              │  timeseries, …      │                         └──────────────┘
              └─────────────────────┘
```

| Hop | Role |
| --- | --- |
| Simulator | Walks a ride session state machine and POSTs events (or batches). |
| `POST /events`, `/events/batch` | Accept traffic; batch allows partial success (207). |
| Zod (`packages/shared`) | Discriminated-union validation; failures never enter `events`. |
| Postgres | Durable store; `eventId` is the PK / idempotency key. |
| `GET /metrics/*` | All rollups in SQL over `?from=&to=` (default last 7 days). |
| Dashboard | Vite + React; polls metrics (optional Live every 3s). |

Locally the API listens on port **3000**; the dashboard on **5173** and proxies `/metrics` to the API. The repo also includes `api/index.ts` and `vercel.json` (rewrites for `/metrics/*` and ingest paths) so the same app can be deployed as Vercel serverless later; there is no hosted deployment in this take-home as shipped.

## Quickstart

Prerequisites: **Node 20+**, and a Postgres connection string (Neon pooled URL with `-pooler` in the host is what this repo expects).

```bash
npm install
cp .env.example .env
```

Edit `.env` and set at least `DATABASE_URL`. Optional: `INGEST_URL` (default `http://localhost:3000`), `CAMPUS_TIMEZONE` (default `America/New_York`).

```bash
npm run migrate
```

In one terminal, start the API (port **3000**):

```bash
npm run dev
```

In another, start the dashboard (port **5173**):

```bash
npm run dev:web
```

Seed historical traffic (API must be up):

```bash
npm run simulate:backfill -- --events 5000 --days 14 --seed 42
```

Open [http://localhost:5173](http://localhost:5173).

## Event schema

Every event shares an envelope, then type-specific fields at the top level (flat discriminated union on `type`).

| Field | Purpose |
| --- | --- |
| `eventId` | Client-generated UUID. Primary key of `events` and the **idempotency key** — retries must reuse the same id. |
| `type` | Discriminator; selects the Zod member schema. |
| `timestamp` | Client clock, ISO-8601 with offset; stored as `occurred_at`. |
| `userId` | Actor. |
| `sessionId` | Groups events from one app session / ride journey. |
| `schemaVersion` | Literal `1` today; allows additive evolution without a table migration. |

| `type` | Type-specific properties |
| --- | --- |
| `user_signed_up` | `campus`, `referralSource` |
| `ride_searched` | `origin`, `destination`, `departAt` |
| `ride_requested` | `rideId`, `origin`, `destination`, `seatsWanted` |
| `ride_matched` | `rideId`, `driverId`, `matchLatencyMs` |
| `ride_accepted` | `rideId`, `driverId` |
| `ride_cancelled` | `rideId`, `cancelledBy` (`rider` \| `driver`), `reason` |
| `ride_completed` | `rideId`, `durationMin`, `distanceMi`, `fareCents` |
| `driver_rated` | `rideId`, `driverId`, `stars` (1–5) |
| `post_created` | `postId`, `kind` (`ride_offer` \| `ride_request` \| `social`) |
| `message_sent` | `threadId`, `recipientId` |

Example:

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "ride_requested",
  "timestamp": "2026-07-15T12:04:22.000Z",
  "userId": "user_0042",
  "sessionId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "schemaVersion": 1,
  "rideId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "origin": "East Dorms",
  "destination": "Downtown Transit",
  "seatsWanted": 2
}
```

Envelope columns land in dedicated table fields; the type-specific keys are stored in `properties` jsonb.

## Simulator

The simulator does not emit independent random events. It walks a session state machine:

```
signed_up? → ride_searched → (abandon | ride_requested)
  → (cancel before match | ride_matched)
    → (no-accept cancel/timeout | ride_accepted)
      → (cancel after accept | ride_completed → maybe driver_rated)
```

Abandonment ends the session with no further events; cancellation emits `ride_cancelled`. Branching is weighted (search abandon ~25%, overall cancel ~18% of requests, ~8% of matches never accept, ~70% of completes get a rating). Session start times are biased toward 8am and 5pm campus peaks. Match latency is lognormal (median ~45s). Fares come from route distance, not a uniform random draw. `post_created` / `message_sent` are sprinkled between ride steps. `--seed` makes output deterministic.

| Flag | Meaning |
| --- | --- |
| `--url <url>` | Ingest base URL (default: `INGEST_URL` or `http://localhost:3000`) |
| `--mode backfill\|stream` | Historical batches vs live token-bucket stream |
| `--events <n>` | Backfill: total events to generate (default 5000) |
| `--days <n>` | Backfill: spread session starts over the past N days (default 7) |
| `--rate <n>` | Stream: target events per second (default 10) |
| `--duplicate-rate <0-1>` | Fraction of verbatim resends to exercise dedup |
| `--error-rate <0-1>` | Fraction of malformed payloads to exercise validation / dead-letter |
| `--seed <n>` | RNG seed (default 42) |

Prove idempotency (expect non-zero `duplicates` in the progress line):

```bash
npm run simulate:backfill -- --events 1000 --days 7 --seed 42 --duplicate-rate 0.1
```

Prove validation + dead-lettering (expect non-zero `rejected`; rows land in `dead_letter_events`):

```bash
npm run simulate:backfill -- --events 1000 --days 7 --seed 42 --error-rate 0.05
```

Live stream (Ctrl+C to stop):

```bash
npm run simulate:stream -- --rate 10 --duplicate-rate 0.05
```

## Metrics

All endpoints accept `?from=` and `?to=` (ISO date or datetime). Default range is the last **7 days**. Timeseries and routes add the params below. Heatmap and timeseries responses include the `timezone` used for campus-local bucketing (`CAMPUS_TIMEZONE`).

| Endpoint | Extra query params | Computes |
| --- | --- | --- |
| `GET /metrics/summary` | — | Totals: events, users, sessions, completed rides, gross fare, cancel rate, match latency p50/p95 |
| `GET /metrics/funnel` | — | Distinct sessions per ride step + conversion from previous / from top |
| `GET /metrics/timeseries` | `granularity=hour\|day` (default `day`), optional `type=` | Gap-filled event counts via `generate_series` |
| `GET /metrics/routes` | `limit` (default 10) | Top origin→destination by completed rides, with avg fare and duration |
| `GET /metrics/heatmap` | — | Full 7×24 dow×hour grid of event counts (campus-local) |
| `GET /metrics/pipeline-health` | — | Accepted vs dead-letter counts and the 5 newest dead-letter payloads |

Also: `GET /health`, `POST /events`, `POST /events/batch` (max 500 per batch).

## Design decisions

### Idempotency via client-generated `eventId`

**Problem:** Mobile and simulator clients retry. Blind inserts would double-count.

**Choice:** Clients mint `eventId` before the first send. Ingest uses `INSERT … ON CONFLICT (id) DO NOTHING` and reports `duplicate`. The id must exist *before* the first attempt; a server-assigned id on response cannot protect an in-flight retry that never saw the response.

### Dead-letter table instead of dropping invalid events

**Problem:** Malformed traffic is inevitable. Returning 400 and discarding the body loses forensic signal.

**Choice:** Invalid payloads (and Zod issues) are written to `dead_letter_events`. The pipeline never silently drops data; `/metrics/pipeline-health` surfaces recent failures.

### Discriminated union over a generic payload

**Problem:** A single `{ type, properties: json }` type forces every consumer to cast.

**Choice:** Zod `discriminatedUnion("type", …)` in `packages/shared` yields a narrowed TypeScript member after parse. The simulator and server import those types; they do not redefine local event shapes.

### `schemaVersion` on every event

**Problem:** Event shapes will change; rewriting historical rows is painful.

**Choice:** `schemaVersion: 1` is required on every event. New versions can be added as additional union members while old rows remain readable.

### Aggregation in SQL

**Problem:** Pulling raw events into Node for percentiles and gap-filled series does not scale and duplicates logic.

**Choice:** Metrics queries use Postgres (`percentile_cont`, `FILTER`, `generate_series`, window functions). The API maps row shapes to shared response types only.

### Campus timezone bucketing

**Problem:** `extract(hour FROM timestamptz)` is UTC. Simulator rush hours at 8am/5pm Eastern appeared at UTC hours (e.g. 12 and 21), so the heatmap looked wrong.

**Choice:** Heatmap and timeseries truncate/extract after `occurred_at AT TIME ZONE CAMPUS_TIMEZONE` (default `America/New_York`) and return that timezone in the JSON for axis labels.

### Serverless Postgres settings

**Problem:** The project targets a serverless runtime (short-lived isolates, Neon pooler in transaction mode), even though the default workflow is local `npm run dev`.

**Choice:** `postgres.js` with `max: 1` (one connection per isolate) and `prepare: false` (PgBouncer transaction mode cannot safely use named prepared statements). Those settings follow from the serverless constraint, not from a live hosted deploy.

### Polling instead of WebSockets

**Problem:** The dashboard wants near-live updates, but a serverless target cannot hold persistent WebSocket connections.

**Choice:** Optional Live mode polls `/metrics/*` every 3 seconds. That is a consequence of designing against the same serverless constraint as the DB client above.

## Project structure

```
packages/
  shared/      Event Zod schemas, inferred types, metrics response types, parseEvent
  server/      Fastify ingest + metrics, Neon client, migrations, funnel integration test
  simulator/   Seeded CLI traffic generator (backfill + stream)
  web/         Vite + React + Recharts dashboard
api/           Vercel serverless entry wrapping the Fastify app (present; not required for local run)
```

## Testing

```bash
npm test
```

Runs the server package tests via Node’s test runner (`tsx --test`). Coverage today: an integration test for `queryFunnel` that inserts a known set of sessions into Postgres and asserts exact step counts and conversion ratios.
