// Fixed campus locations and weighted popular routes with mile distances.

export type Location = {
  name: string;
};

/** ~12 named campus spots — keep the set small so popular routes dominate. */
export const LOCATIONS: readonly Location[] = [
  { name: "North Campus" },
  { name: "South Quad" },
  { name: "Engineering Hall" },
  { name: "Main Library" },
  { name: "Downtown Transit" },
  { name: "Airport" },
  { name: "Stadium" },
  { name: "Student Union" },
  { name: "East Dorms" },
  { name: "West Apartments" },
  { name: "Medical Center" },
  { name: "Grocery Plaza" },
] as const;

export type Route = {
  origin: string;
  destination: string;
  distanceMi: number;
  /** Relative popularity — higher means more searches/requests. */
  weight: number;
};

/**
 * Hand-tuned popular O/D pairs. A few corridors carry most traffic
 * (dorms↔downtown, north↔engineering) so charts show clear hot routes.
 */
export const ROUTES: readonly Route[] = [
  { origin: "East Dorms", destination: "Downtown Transit", distanceMi: 2.4, weight: 12 },
  { origin: "Downtown Transit", destination: "East Dorms", distanceMi: 2.4, weight: 10 },
  { origin: "North Campus", destination: "Engineering Hall", distanceMi: 1.1, weight: 11 },
  { origin: "Engineering Hall", destination: "North Campus", distanceMi: 1.1, weight: 9 },
  { origin: "West Apartments", destination: "Student Union", distanceMi: 1.8, weight: 8 },
  { origin: "Student Union", destination: "West Apartments", distanceMi: 1.8, weight: 7 },
  { origin: "South Quad", destination: "Main Library", distanceMi: 0.6, weight: 7 },
  { origin: "Main Library", destination: "South Quad", distanceMi: 0.6, weight: 6 },
  { origin: "East Dorms", destination: "Grocery Plaza", distanceMi: 1.5, weight: 6 },
  { origin: "West Apartments", destination: "Grocery Plaza", distanceMi: 2.0, weight: 5 },
  { origin: "Stadium", destination: "Downtown Transit", distanceMi: 3.2, weight: 4 },
  { origin: "Medical Center", destination: "North Campus", distanceMi: 2.8, weight: 4 },
  { origin: "Airport", destination: "North Campus", distanceMi: 8.5, weight: 3 },
  { origin: "North Campus", destination: "Airport", distanceMi: 8.5, weight: 3 },
  { origin: "Airport", destination: "West Apartments", distanceMi: 9.2, weight: 2 },
  { origin: "South Quad", destination: "Medical Center", distanceMi: 3.5, weight: 2 },
  { origin: "Engineering Hall", destination: "Stadium", distanceMi: 2.2, weight: 2 },
  { origin: "Grocery Plaza", destination: "Student Union", distanceMi: 1.3, weight: 2 },
];

/** Base $2.50 + $1.50/mi, rounded to cents — fare is a function of distance, not RNG. */
export function fareCentsFromDistance(distanceMi: number): number {
  return Math.round(250 + 150 * distanceMi);
}

/** Rough trip duration: ~2.5 min/mi urban + 3 min fixed (pickup / egress). */
export function durationMinFromDistance(distanceMi: number): number {
  return Math.round(3 + 2.5 * distanceMi);
}
