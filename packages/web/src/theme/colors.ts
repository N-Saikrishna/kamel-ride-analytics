// Reads theme CSS custom properties for Recharts / canvas-style color use.

function readVar(name: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (value.length === 0) {
    throw new Error(`Missing CSS custom property ${name}`);
  }
  return value;
}

/** Snapshot of chart-relevant tokens (call from render after CSS is loaded). */
export function chartColors() {
  return {
    border: readVar("--border"),
    textMuted: readVar("--text-muted"),
    surface: readVar("--surface"),
    surfaceRaised: readVar("--surface-raised"),
    amber: readVar("--amber"),
    camel: readVar("--camel"),
    timeseriesFill: readVar("--timeseries-fill"),
    series: [
      readVar("--series-1"),
      readVar("--series-2"),
      readVar("--series-3"),
      readVar("--series-4"),
      readVar("--series-5"),
    ] as const,
    heatmap: [
      readVar("--heatmap-0"),
      readVar("--heatmap-1"),
      readVar("--heatmap-2"),
      readVar("--heatmap-3"),
    ] as const,
  };
}

function parseHex(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.round(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Sequential desert scale: surface-raised → camel-dark → camel → amber. */
export function heatmapFill(intensity: number): string {
  const stops = chartColors().heatmap;
  const t = Math.min(1, Math.max(0, intensity));
  const segments = stops.length - 1;
  const scaled = t * segments;
  const i = Math.min(segments - 1, Math.floor(scaled));
  const local = scaled - i;
  const from = stops[i];
  const to = stops[i + 1];
  if (from === undefined || to === undefined) {
    return stops[0] ?? "#2a2219";
  }
  const [r1, g1, b1] = parseHex(from);
  const [r2, g2, b2] = parseHex(to);
  return toHex(lerp(r1, r2, local), lerp(g1, g2, local), lerp(b1, b2, local));
}
