// HTTP client for POST /events and POST /events/batch against the ingest API.

export type BatchResult = {
  accepted: number;
  duplicates: number;
  rejected: number;
};

export type SingleResult = {
  accepted: number;
  duplicates: number;
  rejected: number;
};

export type WirePayload = unknown;

export class IngestClient {
  constructor(private readonly baseUrl: string) {}

  async postBatch(events: WirePayload[]): Promise<BatchResult> {
    const res = await fetch(`${this.baseUrl}/events/batch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(events),
    });

    const body: unknown = await res.json().catch(() => null);

    if (res.status === 207 && isBatchBody(body)) {
      return {
        accepted: body.accepted,
        duplicates: body.duplicates,
        rejected: body.rejected.length,
      };
    }

    if (res.status === 400 && isBatchBody(body)) {
      return {
        accepted: body.accepted,
        duplicates: body.duplicates,
        rejected: body.rejected.length,
      };
    }

    throw new Error(
      `Batch ingest failed (${res.status}): ${JSON.stringify(body)}`,
    );
  }

  async postOne(event: WirePayload): Promise<SingleResult> {
    const res = await fetch(`${this.baseUrl}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });

    const body: unknown = await res.json().catch(() => null);

    if (res.status === 200 && isSingleOk(body)) {
      return {
        accepted: 1,
        duplicates: body.duplicate ? 1 : 0,
        rejected: 0,
      };
    }

    if (res.status === 400) {
      return { accepted: 0, duplicates: 0, rejected: 1 };
    }

    throw new Error(
      `Single ingest failed (${res.status}): ${JSON.stringify(body)}`,
    );
  }
}

function isBatchBody(
  body: unknown,
): body is {
  accepted: number;
  duplicates: number;
  rejected: unknown[];
} {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const record = body as Record<string, unknown>;
  return (
    typeof record.accepted === "number" &&
    typeof record.duplicates === "number" &&
    Array.isArray(record.rejected)
  );
}

function isSingleOk(
  body: unknown,
): body is { accepted: true; duplicate: boolean } {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const record = body as Record<string, unknown>;
  return record.accepted === true && typeof record.duplicate === "boolean";
}
