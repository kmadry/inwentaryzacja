import { AMBIGUOUS_REMAINDER_G, EVENT_MIN_G, FULL_BOTTLE_G } from "./config";

export type Calibration = { offset_raw: number; raw_per_g: number };

export type RawReading = {
  id: number;
  raw: number;
  created_at: string;
  measured_at: string | null;
};

export type Point = {
  id: number;
  raw: number;
  grams: number;
  /** coalesce(measured_at, created_at) w ms */
  at: number;
};

export type WeightEvent = {
  id: number;
  at: number;
  deltaG: number;
  bottles: number;
  remainderG: number;
  ambiguous: boolean;
  afterG: number;
};

export const toGrams = (raw: number, c: Calibration): number => Math.round((raw - c.offset_raw) / c.raw_per_g);

export const eventAt = (r: RawReading): number => Date.parse(r.measured_at ?? r.created_at);

/** Przelicza i sortuje odczyty po czasie zdarzenia (remis – po id). */
export function toPoints(rows: RawReading[], c: Calibration): Point[] {
  return rows
    .map((r) => ({ id: r.id, raw: r.raw, grams: toGrams(r.raw, c), at: eventAt(r) }))
    .filter((p) => Number.isFinite(p.at) && Number.isFinite(p.grams))
    .sort((a, b) => a.at - b.at || a.id - b.id);
}

export const bottlesFor = (grams: number): number => Math.round(grams / FULL_BOTTLE_G);

/** Zdarzenia z kolejnych odczytów; zwraca od najnowszego. */
export function detectEvents(points: Point[], fromMs: number): WeightEvent[] {
  const out: WeightEvent[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    if (cur.at < fromMs) continue;
    const deltaG = cur.grams - prev.grams;
    if (Math.abs(deltaG) < EVENT_MIN_G) continue;
    const bottles = Math.round(deltaG / FULL_BOTTLE_G);
    const remainderG = Math.abs(deltaG - bottles * FULL_BOTTLE_G);
    out.push({
      id: cur.id,
      at: cur.at,
      deltaG,
      bottles,
      remainderG,
      ambiguous: remainderG > AMBIGUOUS_REMAINDER_G,
      afterG: cur.grams,
    });
  }
  return out.reverse();
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of empty list");
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}
