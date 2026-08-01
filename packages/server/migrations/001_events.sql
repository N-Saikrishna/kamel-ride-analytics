-- Events table + dead-letter queue for the analytics ingestion pipeline.

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  schema_version INT NOT NULL,
  properties JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS dead_letter_events (
  id BIGSERIAL PRIMARY KEY,
  raw JSONB NOT NULL,
  errors JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- type + time for per-event-type dashboards; occurred_at alone for global time ranges.
CREATE INDEX IF NOT EXISTS events_type_occurred_at_idx ON events (type, occurred_at);
CREATE INDEX IF NOT EXISTS events_occurred_at_idx ON events (occurred_at);
