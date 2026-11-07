"use server";

import { revalidatePath } from "next/cache";
import { DEVICE_DELTA_RAW, MEDIAN_SAMPLES } from "@/lib/config";
import { median, type RawReading } from "@/lib/compute";
import { getLatestRaw, getStation } from "@/lib/data";
import { fmtDec, fmtInt } from "@/lib/format";
import { AppError, db, sbError } from "@/lib/supabase";

export type ActionState = { ok: boolean; message: string; at: number } | null;

const fail = (message: string): ActionState => ({ ok: false, message, at: Date.now() });
const done = (message: string): ActionState => ({ ok: true, message, at: Date.now() });

function describe(e: unknown): string {
  if (e instanceof AppError) return `${e.title} ${e.fix}`;
  return e instanceof Error ? `Nieoczekiwany błąd: ${e.message}` : "Nieoczekiwany błąd.";
}

/**
 * Mediana ostatnich odczytów + kontrola stabilności. Urządzenie wysyła odczyt przy zmianie
 * ≥ DEVICE_DELTA_RAW albo co 5 min, więc tuż po zmianie na wadze część z ostatnich 5 odczytów
 * pochodzi sprzed zmiany. Mediana jest odporna na 2 takie odczyty, ale najnowszy odczyt
 * musi się z nią zgadzać – inaczej mediana opisuje stan sprzed zmiany.
 */
async function stableMedian(): Promise<{ value: number } | { error: string }> {
  const rows: RawReading[] = await getLatestRaw(MEDIAN_SAMPLES);
  if (rows.length < MEDIAN_SAMPLES) {
    return {
      error: `Za mało odczytów: w bazie jest ${rows.length}, potrzeba ${MEDIAN_SAMPLES}. Odczekaj, aż waga wyśle kolejne odczyty (heartbeat co 5 min).`,
    };
  }
  const raws = rows.map((r) => r.raw);
  const m = median(raws);
  const newest = raws[0]!;
  if (Math.abs(newest - m) >= DEVICE_DELTA_RAW) {
    return {
      error:
        "Masa na wadze zmieniła się niedawno – mediana ostatnich odczytów nie odpowiada temu, co teraz leży na platformie. " +
        "Odczekaj ok. 15 min (3 heartbeaty) bez ruszania wagi i spróbuj ponownie.",
    };
  }
  return { value: m };
}

export async function tareAction(_prev: ActionState, _form: FormData): Promise<ActionState> {
  try {
    const station = await getStation();
    const res = await stableMedian();
    if ("error" in res) return fail(res.error);
    const offset = res.value;
    const nowIso = new Date().toISOString();

    const { error } = await db()
      .from("stations")
      .update({ offset_raw: offset, tared_at: nowIso })
      .eq("id", station.id);
    if (error) {
      if (error.code === "PGRST204" || error.code === "42703") {
        const retry = await db().from("stations").update({ offset_raw: offset }).eq("id", station.id);
        if (retry.error) return fail(describe(sbError("Nie udało się zapisać tarowania", retry.error)));
        revalidatePath("/");
        return done(
          `Wyzerowano (offset_raw = ${fmtInt(offset)}), ale nie zapisano daty: brak kolumny tared_at. ` +
            "Uruchom migrację supabase/migrations/20261107000000_dashboard.sql.",
        );
      }
      return fail(describe(sbError("Nie udało się zapisać tarowania", error)));
    }
    revalidatePath("/");
    return done(
      `Wyzerowano. Nowe zero: ${fmtInt(offset)} (było ${fmtInt(station.offset_raw)}). Kolejny odczyt wagi powinien pokazać 0,0 kg.`,
    );
  } catch (e) {
    return fail(describe(e));
  }
}

function parseGrams(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string") return null;
  const n = Number(v.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function calibrateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const massG = parseGrams(form.get("mass_g"));
  if (massG === null || massG <= 0) return fail("Podaj masę wzorca w gramach jako liczbę większą od zera, np. 16440.");
  if (massG < 1000) {
    return fail("Użyj wzorca o masie co najmniej 1000 g (np. pełnej skrzynki) – przy małej masie błąd kalibracji będzie duży.");
  }
  try {
    const station = await getStation();
    const res = await stableMedian();
    if ("error" in res) return fail(res.error);
    const perG = (res.value - station.offset_raw) / massG;
    if (!Number.isFinite(perG) || perG <= 0) {
      return fail(
        `Odczyt (${fmtInt(res.value)}) nie jest większy od zera wagi (offset_raw = ${fmtInt(station.offset_raw)}). ` +
          "Najpierw wyzeruj pustą wagę, potem połóż wzorzec, odczekaj ok. 15 min i spróbuj ponownie.",
      );
    }
    const { error } = await db().from("stations").update({ raw_per_g: perG }).eq("id", station.id);
    if (error) return fail(describe(sbError("Nie udało się zapisać kalibracji", error)));
    revalidatePath("/");
    return done(`Skalibrowano: raw_per_g = ${fmtDec(perG)} (było ${fmtDec(station.raw_per_g)}).`);
  } catch (e) {
    return fail(describe(e));
  }
}
