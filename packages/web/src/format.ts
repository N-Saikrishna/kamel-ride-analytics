// Display formatters — cents→dollars, ms→seconds, compact counts.

export function formatDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatSeconds(ms: number | null): string {
  if (ms === null) {
    return "—";
  }
  const seconds = ms / 1000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatDropOff(conversionFromPrevious: number | null): string {
  if (conversionFromPrevious === null) {
    return "";
  }
  const drop = (1 - conversionFromPrevious) * 100;
  return `↓ ${drop.toFixed(0)}%`;
}

export function shortStepLabel(step: string): string {
  return step.replace(/^ride_/, "").replace(/_/g, " ");
}
