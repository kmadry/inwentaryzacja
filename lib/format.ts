import { LOCALE, TIME_ZONE } from "./config";

const kg1 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const int = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 4 });

export const fmtKg = (grams: number): string => kg1.format(grams / 1000);
export const fmtInt = (n: number): string => int.format(n);
export const fmtDec = (n: number): string => dec.format(n);
export const fmtSignedKg = (grams: number): string =>
  (grams > 0 ? "+" : grams < 0 ? "−" : "±") + kg1.format(Math.abs(grams) / 1000);
export const fmtSignedInt = (n: number): string =>
  (n > 0 ? "+" : n < 0 ? "−" : "±") + int.format(Math.abs(n));

const timeFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: "numeric", month: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

export const fmtTime = (ms: number): string => timeFmt.format(ms);
export const fmtDateTime = (ms: number): string => dateTimeFmt.format(ms);

/** Godzina, a dla dni innych niż bieżący (w Warszawie) – także data. */
export function fmtEventTime(ms: number, nowMs: number): string {
  if (dayKeyFmt.format(ms) === dayKeyFmt.format(nowMs)) return fmtTime(ms);
  return `${dayFmt.format(ms)} ${fmtTime(ms)}`;
}

/** „5 min”, „2 h 5 min”. */
export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} dni`;
}
